plugins {
    alias(libs.plugins.node)
}

node {
    download = true
    version = libs.versions.node
    npmVersion = libs.versions.npm
    npmInstallCommand = "ci"
}
group = "io.github.FantasyWiki"
