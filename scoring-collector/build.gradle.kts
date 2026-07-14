import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.gradle.api.tasks.testing.logging.TestLogEvent

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.qa)
    alias(libs.plugins.kover)
    application
}

group = "io.github.fantasywiki"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))
    implementation(libs.bundles.collector.runtime)
    testImplementation(libs.bundles.kotlin.testing)
    testImplementation(libs.bundles.collector.testing)
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
