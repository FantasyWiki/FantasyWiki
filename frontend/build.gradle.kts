plugins {
    alias(libs.plugins.node)
}

node {
    download = true
    version = libs.versions.node
    npmVersion = libs.versions.npm
}

tasks.register("check") {
    dependsOn(
        "npm_run_lint",
        "npm_run_test-unit",
        "npm_run_type-check"
    )
}
