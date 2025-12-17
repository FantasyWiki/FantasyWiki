plugins {
    alias(libs.plugins.gitSemVer)
    alias(libs.plugins.taskTree)
}

buildscript {
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

// This is needed to make sure the "check" task exists for the CI to pass
tasks.register("check") {
}

group = "io.github.FantasyWiki"
