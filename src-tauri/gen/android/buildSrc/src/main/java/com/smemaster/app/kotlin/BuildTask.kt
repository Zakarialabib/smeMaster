import java.io.File
import java.util.Properties
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    /**
     * Resolve the cargo executable path.
     * On Windows, Gradle may not inherit the user's PATH correctly,
     * so we search the standard locations if not found in PATH.
     */
    private fun resolveCargo(): String {
        val candidates = if (Os.isFamily(Os.FAMILY_WINDOWS)) {
            listOf("cargo", "cargo.exe")
        } else {
            listOf("cargo")
        }
        for (name in candidates) {
            try {
                val process = ProcessBuilder(name, "--version")
                    .redirectErrorStream(true)
                    .start()
                val exitCode = process.waitFor()
                if (exitCode == 0) return name
            } catch (_: Exception) {
                // not found in PATH, try next
            }
        }
        // Fallback: search in standard cargo home locations
        val homeDir = System.getProperty("user.home")
        val searchPaths = listOf(
            File(homeDir, ".cargo/bin"),
            File(System.getenv("CARGO_HOME") ?: "", "bin"),
        ).filter { it.exists() }

        for (dir in searchPaths) {
            val exts = if (Os.isFamily(Os.FAMILY_WINDOWS))
                listOf("cargo.exe", "cargo.cmd")
            else
                listOf("cargo")
            for (ext in exts) {
                val candidate = File(dir, ext)
                if (candidate.exists()) return candidate.absolutePath
            }
        }

        // Last resort: let Gradle try (will produce a clearer error)
        return "cargo"
    }

    @TaskAction
    fun assemble() {
        val executable = resolveCargo()
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                ).filter { it != executable } // skip if already tried

                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e;
            }
        }
    }

    /**
     * Locate the Android NDK directory.
     *
     * Checks (in order):
     * 1. ANDROID_NDK_HOME environment variable
     * 2. ANDROID_NDK_ROOT environment variable
     * 3. ndk.dir from local.properties
     * 4. SDK ndk/ directory under sdk.dir from local.properties
     * 5. Default SDK installation paths (~/Android/Sdk/ndk/)
     */
    private fun findNdkDir(): String {
        // 1. Environment variables set by build toolchain or user
        System.getenv("ANDROID_NDK_HOME")?.let { return it }
        System.getenv("ANDROID_NDK_ROOT")?.let { return it }

        // 2. local.properties in app module dir or parent dir (gen/android/)
        val propFiles = listOf(
            File(project.projectDir, "local.properties"),
            File(project.projectDir.parentFile, "local.properties"),
        )
        for (propFile in propFiles) {
            if (propFile.exists()) {
                val props = Properties()
                propFile.inputStream().use { props.load(it) }
                // Try ndk.dir first
                props.getProperty("ndk.dir")?.let { return it }
                // Then derive latest NDK from sdk.dir/ndk/
                val sdkDir = props.getProperty("sdk.dir")?.replace("\\", "/") ?: continue
                val ndkDir = File(sdkDir, "ndk")
                if (ndkDir.exists()) {
                    return ndkDir.listFiles()
                        ?.filter { it.isDirectory }
                        ?.maxByOrNull { it.name }
                        ?.absolutePath
                        ?: continue
                }
            }
        }

        // 3. Default SDK installation paths
        val homeDir = System.getProperty("user.home")
        val sdkCandidates = listOfNotNull(
            "$homeDir/Android/Sdk",
            "$homeDir/AppData/Local/Android/Sdk",
            System.getenv("LOCALAPPDATA")?.let { "$it/Android/Sdk" },
        )
        for (sdkPath in sdkCandidates) {
            val ndkDir = File(sdkPath, "ndk")
            if (ndkDir.exists()) {
                return ndkDir.listFiles()
                    ?.filter { it.isDirectory }
                    ?.maxByOrNull { it.name }
                    ?.absolutePath
                    ?: continue
            }
        }

        throw GradleException(
            "Cannot locate Android NDK. " +
            "Set ANDROID_NDK_HOME or add ndk.dir to local.properties."
        )
    }

    private fun ndkHostTag(): String = when {
        Os.isFamily(Os.FAMILY_WINDOWS) -> "windows-x86_64"
        Os.isFamily(Os.FAMILY_MAC) -> {
            val arch = System.getProperty("os.arch")
            if (arch == "aarch64") "darwin-aarch64" else "darwin-x86_64"
        }
        Os.isFamily(Os.FAMILY_UNIX) -> "linux-x86_64"
        else -> throw GradleException("Unsupported OS for Android NDK cross-compilation")
    }

    /**
     * Resolve a tool path in the NDK toolchain.
     *
     * For clang-based tools: returns the triple-prefixed wrapper
     * (e.g. `armv7a-linux-androideabi24-clang.cmd`) which sets
     * `--target` and `--sysroot` correctly.
     *
     * For other tools (llvm-ar, etc.): returns the plain tool file.
     */
    private fun ndkTool(tool: String, ndkTriple: String, ndkDir: String): String {
        val binDir = File(ndkDir, "toolchains/llvm/prebuilt/${ndkHostTag()}/bin")

        if (tool.startsWith("clang")) {
            val api = ndkMinimumApi(ndkDir)
            val clangBase = "${ndkTriple}${api}-clang"
            val candidates = if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                listOf("$clangBase.cmd", "$clangBase.exe", clangBase)
            } else {
                listOf(clangBase, "$clangBase.cmd")
            }
            for (name in candidates) {
                val f = File(binDir, name)
                if (f.exists()) return f.absolutePath
            }
            throw GradleException(
                "NDK clang wrapper not found for $ndkTriple in $binDir. " +
                "Tried: ${candidates.joinToString(", ")}"
            )
        }

        // For other tools (llvm-ar, ld.gold, etc.), use plain name
        val withExt = if (Os.isFamily(Os.FAMILY_WINDOWS) && !tool.endsWith(".exe"))
            "$tool.exe" else tool
        val plainTool = File(binDir, withExt)
        if (plainTool.exists()) return plainTool.absolutePath

        throw GradleException(
            "NDK tool '$tool' not found in $binDir. " +
            "Ensure NDK is correctly installed at $ndkDir"
        )
    }

    /**
     * Determine the minimum Android API level for NDK toolchain wrappers.
     * NDK r24+ uses API 24 by default; earlier used API 21.
     */
    private fun ndkMinimumApi(ndkDir: String): String {
        val ndkName = File(ndkDir).name
        val major = Regex("""(\d+)""").find(ndkName)
            ?.groupValues?.get(1)?.toIntOrNull() ?: 26
        return if (major >= 24) "24" else "21"
    }

    /**
     * All Android cross-compilation targets with their
     * Rust triple and NDK triple mappings.
     */
    private data class AndroidTarget(
        val rustTriple: String,  // e.g. "armv7-linux-androideabi"
        val ndkTriple: String,   // e.g. "armv7a-linux-androideabi"
    )

    private val androidTargets = listOf(
        AndroidTarget("armv7-linux-androideabi", "armv7a-linux-androideabi"),
        AndroidTarget("aarch64-linux-android", "aarch64-linux-android"),
        AndroidTarget("i686-linux-android", "i686-linux-android"),
        AndroidTarget("x86_64-linux-android", "x86_64-linux-android"),
    )

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        // ── Resolve Android NDK for cross-compilation ──
        // These env vars are normally set in .cargo/config.toml's [env] section,
        // but that section is ONLY loaded when cargo's CWD matches the manifest
        // directory. When Gradle invokes cargo via --manifest-path from the
        // project root, the [env] settings are silently ignored.
        //
        // By passing them directly as process environment variables, they are
        // inherited by cargo and all its subprocesses (rustc, cc crate, etc.)
        // regardless of CWD.
        val ndkDir = findNdkDir()
        logger.info("Configuring Cargo cross-compilation with NDK at: $ndkDir")

        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args("tauri", "android", "android-studio-script")
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args("--target", target)

            // ── Inject cross-compilation environment variables ──
            // These mirror src-tauri/.cargo/config.toml settings
            for (arch in androidTargets) {
                val (rustTriple, ndkTriple) = arch
                val linkerEnv = "CARGO_TARGET_${rustTriple.uppercase().replace('-', '_')}_LINKER"
                val ccEnv = "CC_${rustTriple.replace('-', '_')}"
                val arEnv = "AR_${rustTriple.replace('-', '_')}"

                val clangPath = ndkTool("clang", ndkTriple, ndkDir)
                val arPath = ndkTool("llvm-ar", ndkTriple, ndkDir)

                environment(linkerEnv, clangPath)
                environment(ccEnv, clangPath)
                environment(arEnv, arPath)

                logger.info("  $linkerEnv = $clangPath")
                logger.info("  $ccEnv = $clangPath")
                logger.info("  $arEnv = $arPath")
            }
        }.assertNormalExitValue()
    }
}