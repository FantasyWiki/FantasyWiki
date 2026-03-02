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
        ":frontend:npm_run_dev",
        ":backend:npm_run_dev",
    )
}

group = "io.github.FantasyWiki"
