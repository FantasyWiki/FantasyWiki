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

tasks.register("check") {
    dependsOn(
        "npm_audit",
        "npm_run_format",
        "npm_run_lint",
        "npm_run_test",
    )
}

tasks.register("fix") {
    dependsOn(
        "npm_run_formatfix",
        "npm_run_lintfix",
    )
}
