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

tasks.register<NpmTask>("devMock") {
    npmCommand.set(listOf("run", "dev"))
    environment.set(mapOf("VITE_MOCK" to "true"))
}

tasks.register<NpmTask>("devNoMock") {
    npmCommand.set(listOf("run", "dev"))
    environment.set(mapOf("VITE_MOCK" to "false"))
}

// `vitest run --coverage` is `vitest run` plus a report, so CI asks for the
// report from the run it was already going to do. Without this the suite is
// executed twice per push, once for the gate and once for the coverage board.
// Locally the plain run stays the default: the report costs time nobody reads.
tasks.register<NpmTask>("npm_run_test_coverage") {
    dependsOn("npmInstall")
    args.set(listOf("run", "test-coverage"))
}

val suite = if (project.hasProperty("coverage")) "npm_run_test_coverage" else "npm_run_test"

tasks.register("check") {
    dependsOn(
        "npm_audit",
        "npm_run_format",
        "npm_run_lint",
        suite,
    )
}

tasks.register("fix") {
    dependsOn(
        "npm_run_formatfix",
        "npm_run_lintfix",
    )
}
