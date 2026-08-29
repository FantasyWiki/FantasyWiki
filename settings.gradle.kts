plugins {
    id("org.danilopianini.gradle-pre-commit-git-hooks") version "2.1.23"
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

gitHooks {
    // No `preCommit` block on purpose. It ran `ktlintCheck`, which `./gradlew
    // check` already runs in CI — so it enforced nothing that was not enforced
    // anyway, at the price of starting a Gradle daemon on every commit. The
    // commit message hook stays: nothing in CI checks that.
    commitMsg { conventionalCommits() }
    createHooks()
}

dependencyResolutionManagement {
    versionCatalogs {
        // The JVM dependencies belong to scoring-collector alone, so they are
        // catalogued apart from the shared `libs` rather than sitting next to
        // entries every subproject can reach for.
        create("collectorLibs") {
            from(files("gradle/collector.versions.toml"))
        }
    }
}

rootProject.name = "FantasyWiki"

include("frontend")
include("backend")
include("scoring-collector")
