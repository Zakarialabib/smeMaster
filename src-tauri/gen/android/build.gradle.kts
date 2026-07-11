buildscript {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://mirrors.cloud.tencent.com/repository/maven/google"); isAllowInsecureProtocol = true }
        maven { url = uri("https://mirrors.cloud.tencent.com/repository/maven/public"); isAllowInsecureProtocol = true }
    }
    dependencies {
        classpath(libs.android.gradle.plugin)
        classpath(libs.kotlin.gradle.plugin)
        classpath(libs.google.services.plugin)
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://mirrors.cloud.tencent.com/repository/maven/google"); isAllowInsecureProtocol = true }
        maven { url = uri("https://mirrors.cloud.tencent.com/repository/maven/public"); isAllowInsecureProtocol = true }
    }
}

tasks.register("clean").configure {
    delete("build")
}
