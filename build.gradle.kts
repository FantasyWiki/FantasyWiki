plugins {
    alias(libs.plugins.gitSemVer)
    alias(libs.plugins.taskTree)
}

buildscript {
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

group = "io.github.FantasyWiki"
