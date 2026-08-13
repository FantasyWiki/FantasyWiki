import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.gradle.api.tasks.testing.logging.TestLogEvent

plugins {
    alias(collectorLibs.plugins.kotlin.jvm)
    alias(collectorLibs.plugins.kotlin.serialization)
    alias(collectorLibs.plugins.kotlin.qa)
    alias(collectorLibs.plugins.kover)
    application
}

group = "io.github.fantasywiki"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))
    implementation(collectorLibs.bundles.runtime)
    testImplementation(collectorLibs.bundles.testing)
}

application {
    mainClass = "io.github.fantasywiki.collector.MainKt"
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        allWarningsAsErrors = true
        freeCompilerArgs.add("-opt-in=kotlin.RequiresOptIn")
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        showStandardStreams = true
        showCauses = true
        showStackTraces = true
        events(*TestLogEvent.values())
        exceptionFormat = TestExceptionFormat.FULL
    }
}

tasks.check {
    dependsOn(tasks.koverXmlReport)
}
