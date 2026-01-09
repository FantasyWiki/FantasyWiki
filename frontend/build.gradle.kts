plugins {
    alias(libs.plugins.node)
}

node {
    download = true
    version = libs.versions.node
    npmVersion = libs.versions.npm
    npmInstallCommand = "ci"
}

tasks.register("check") {
    dependsOn(
        "npm_audit",
        "npm_run_lint",
        "npm_run_test-unit"
    )
}
