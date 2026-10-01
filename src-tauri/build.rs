fn main() {
  tauri_build::build();

  // `app_lib` links comctl32 v6-only imports (SetWindowSubclass,
  // RemoveWindowSubclass, DefSubclassProc, TaskDialogIndirect — via tauri
  // dialog/tray), but tauri-build's app manifest, which declares the
  // Microsoft.Windows.Common-Controls v6 dependency, is only embedded into
  // the bins tauri-build manages. Example and test-harness binaries would
  // otherwise load System32's comctl32 v5.81 and die at process start with
  // 0xC0000139 STATUS_ENTRYPOINT_NOT_FOUND — this blocked `cargo test` and
  // the `hf_smoke` real-model example (verified 2026-10-01; mt.exe manifest
  // injection was the proven fix before this build-script change).
  //
  // NOTE: /MANIFESTINPUT (not /MANIFESTDEPENDENCY) because the dependency
  // string contains spaces — cargo's link-arg chain unescapes quotes and
  // would split it, causing LNK1181. /MANIFEST:EMBED is required because
  // rustc's link invocation does not enable manifest embedding (LNK1220).
  // The path must stay quote-free (no spaces in CARGO_MANIFEST_DIR); if the
  // project ever moves to a path with spaces, switch to a linker response
  // file (@file) instead.
  let manifest = std::path::Path::new(
    &std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set"),
  )
  .join("comctl-v6.manifest");
  println!("cargo:rustc-link-arg-examples=/MANIFEST:EMBED");
  println!("cargo:rustc-link-arg-examples=/MANIFESTINPUT:{}", manifest.display());
  println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
  println!("cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}", manifest.display());
}
