plugins {
    alias(libs.plugins.gitSemVer)
    alias(libs.plugins.taskTree)
}

buildscript {
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

tasks.register("check") {
    dependsOn(
        ":frontend:check",
        ":backend:check",
    )
}

tasks.register("dev") {
    dependsOn(
        ":frontend:devNoMock",
        ":backend:npm_run_dev",
    )
}

tasks.register("devMock") {
    dependsOn(
        ":frontend:devMock",
        ":backend:npm_run_dev",
    )
}

tasks.register("fix") {
    dependsOn(
        ":frontend:fix",
        ":backend:fix",
    )
}

group = "io.github.FantasyWiki"
