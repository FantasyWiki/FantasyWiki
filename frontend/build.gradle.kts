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

tasks.register("check") {
    dependsOn(
        "npm_audit",
        "npm_run_format",
        "npm_run_lint",
        "npm_run_test-unit",
    )
}
