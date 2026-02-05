plugins {
    id("org.danilopianini.gradle-pre-commit-git-hooks") version "2.1.9"
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

gitHooks {
    commitMsg { conventionalCommits() }
    createHooks()
}

rootProject.name = "FantasyWiki"

include("frontend")
