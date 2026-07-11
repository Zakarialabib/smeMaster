plugins {
    `kotlin-dsl`
}

gradlePlugin {
    plugins {
        create("pluginsForCoolKids") {
            id = "rust"
            implementationClass = "RustPlugin"
        }
    }
}

repositories {
    google()
    mavenCentral()
    maven { url = uri("https://mirrors.cloud.tencent.com/repository/maven/google"); isAllowInsecureProtocol = true }
    maven { url = uri("https://mirrors.cloud.tencent.com/repository/maven/public"); isAllowInsecureProtocol = true }
}

dependencies {
    compileOnly(gradleApi())
    implementation("com.android.tools.build:gradle:8.13.2")
}
