buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath(libs.android.gradle.plugin)
        classpath(libs.kotlin.gradle.plugin)
        // NOTE: Google Services plugin disabled — no google-services.json configured.
        // Re-enable when Firebase is set up: uncomment the line below and add
        // google-services.json to app/ directory.
        // classpath(libs.google.services.plugin)
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register("clean").configure {
    delete("build")
}
