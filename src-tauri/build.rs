fn main() {
  // ── Dev-only capabilities ──────────────────────────────────────────────
  // `capabilities-dev/` holds capability files that reference permissions from
  // dev-only plugins. They cannot live in `capabilities/` unconditionally: the
  // permission `mcp-bridge:default` only exists when the `mcp-bridge` feature
  // compiles the plugin, so an unconditional file fails EVERY other build with
  //   Permission mcp-bridge:default not found, expected one of ...
  // (verified: this broke `cargo check --features rustls-tls,local-ai`).
  //
  // So copy them in only when the feature is on, and remove them when it is
  // off — tauri_build::build() globs `capabilities/*.json` and runs below.
  //
  // NOTE: this runs before tauri_build::build() on purpose.
  let manifest_dir = std::path::PathBuf::from(
    std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set"),
  );
  let dev_caps = manifest_dir.join("capabilities-dev");
  let caps = manifest_dir.join("capabilities");

  println!("cargo:rerun-if-changed=capabilities-dev");

  if std::env::var("CARGO_FEATURE_MCP_BRIDGE").is_ok() {
    if let Ok(entries) = std::fs::read_dir(&dev_caps) {
      for entry in entries.flatten() {
        let src = entry.path();
        if src.extension().and_then(|e| e.to_str()) != Some("json") {
          continue;
        }
        if let Some(name) = src.file_name() {
          let dest = caps.join(name);
          if std::fs::copy(&src, &dest).is_ok() {
            println!("cargo:warning=mcp-bridge: enabled dev capability {}", name.to_string_lossy());
          }
        }
      }
    }
  } else {
    // Feature off — make sure no stale dev capability is left behind, or the
    // permission lookup fails again.
    if let Ok(entries) = std::fs::read_dir(&dev_caps) {
      for entry in entries.flatten() {
        if let Some(name) = entry.path().file_name() {
          let dest = caps.join(name);
          if dest.exists() {
            let _ = std::fs::remove_file(&dest);
          }
        }
      }
    }
  }

  let mut windows = tauri_build::WindowsAttributes::new();
  windows = windows.app_manifest(include_str!("comctl-v6.manifest"));
  let attrs = tauri_build::Attributes::new().windows_attributes(windows);
  tauri_build::try_build(attrs).expect("tauri build failed");

  if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
    let manifest = manifest_dir.join("comctl-v6.manifest");
    println!("cargo:rustc-link-arg-examples=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-examples=/MANIFESTINPUT:{}", manifest.display());
    println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}", manifest.display());
  }
}
