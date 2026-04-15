import com.github.gradle.node.npm.task.NpmTask
import groovy.json.JsonSlurper

plugins {
    alias(libs.plugins.gitSemVer)
    alias(libs.plugins.taskTree)
    alias(libs.plugins.node)
}

val packageJson = JsonSlurper().parse(file("package.json")) as Map<*, *>
val engines = packageJson["engines"] as Map<*, *>

node {
    download = true
    version = engines["node"] as String
    npmVersion = engines["npm"] as String
    npmInstallCommand = "ci"
}

buildscript {
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

tasks.register("check") {
    dependsOn(
        "npm_ci",
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
