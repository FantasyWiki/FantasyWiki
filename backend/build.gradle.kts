import com.github.gradle.node.npm.task.NpmTask
import groovy.json.JsonSlurper

plugins {
    alias(libs.plugins.node)
}

val packageJson = JsonSlurper().parse(file("package.json")) as Map<*, *>
val engines = packageJson["engines"] as Map<*, *>

node {
    download = true
    version = engines["node"] as String
    npmVersion = engines["npm"] as String
    npmInstallCommand = "ci"
}

tasks.named<NpmTask>("npm_audit") {
    args.set(listOf("--omit=dev"))
}

tasks.register<NpmTask>("npm_run_test_suite") {
    dependsOn("npmInstall")
    args.set(listOf("run", "test:run"))
}

tasks.register<NpmTask>("npm_run_db_init_local") {
    dependsOn("npmInstall")
    args.set(listOf("run", "db:init:local"))
}

tasks.named<NpmTask>("npm_run_dev") {
    dependsOn("npm_run_db_init_local")
}

// Both persistence targets are checked, because a second implementation that is
// not run is not a second implementation (docs/architecture/persistence-targets.md).
// The Mongo suite starts its own single-node replica set unless MONGO_URL points
// at one, so this needs nothing installed; it is sequenced after the D1 suite
// only to keep two Vitest pools off the machine at once.
// `vitest run --coverage` is `vitest run` plus a report, so CI asks for the
// report from the run it was already going to do. Without this the D1 suite is
// executed twice per push, once for the gate and once for the coverage board.
// Locally the plain run stays the default: the report costs time nobody reads.
tasks.register<NpmTask>("npm_run_test_coverage") {
    dependsOn("npmInstall")
    args.set(listOf("run", "test-coverage"))
}

val d1Suite = if (project.hasProperty("coverage")) "npm_run_test_coverage" else "npm_run_test"

tasks.named<NpmTask>("npm_run_testmongo") {
    dependsOn("npmInstall")
    mustRunAfter("npm_run_test", "npm_run_test_coverage")
}

tasks.register("check") {
    dependsOn(
        "npm_audit",
        "npm_run_format",
        "npm_run_lint",
        "npm_run_typecheck",
        d1Suite,
        "npm_run_testmongo",
    )
}

tasks.register("fix") {
    dependsOn(
        "npm_run_formatfix",
        "npm_run_lintfix",
    )
}
