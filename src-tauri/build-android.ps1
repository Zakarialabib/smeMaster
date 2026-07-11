# Build Rust for Android with NDK toolchain
# Usage: .\build-android.ps1 [[-Target] <string>] [[-Command] <string>]
#   Target:  aarch64-linux-android (default), armv7-linux-androideabi, x86_64-linux-android, i686-linux-android
#   Command: check (default), build, clippy

param(
    [string]$Target = "aarch64-linux-android",
    [string]$Command = "check"
)

$NDK_BIN = "$env:ANDROID_HOME\ndk\27.3.13750724\toolchains\llvm\prebuilt\windows-x86_64\bin"

# cc crate checks these env vars for cross-compilation
# Note: PowerShell needs .NET API for hyphens in env var names
[Environment]::SetEnvironmentVariable("CC_aarch64-linux-android", "$NDK_BIN\aarch64-linux-android24-clang.cmd", "Process")
[Environment]::SetEnvironmentVariable("AR_aarch64-linux-android", "$NDK_BIN\llvm-ar.exe", "Process")

Write-Host "=== Building Rust for $Target ===" -ForegroundColor Cyan
Write-Host "  CC: $NDK_BIN\aarch64-linux-android24-clang.cmd"
Write-Host "  AR: $NDK_BIN\llvm-ar.exe"
Write-Host ""

cargo $Command --target $Target
