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
    dependsOn(":frontend:check")
}

group = "io.github.FantasyWiki"
