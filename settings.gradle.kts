plugins {
    id("org.danilopianini.gradle-pre-commit-git-hooks") version "2.1.20"
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

gitHooks {
    preCommit {
        tasks("ktlintCheck")
    }
    commitMsg { conventionalCommits() }
    createHooks()
}

rootProject.name = "FantasyWiki"

include("frontend")
include("backend")
include("scoring-engine")
