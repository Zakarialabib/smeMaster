# Vendored crates

## `tauri-plugin-mcp-bridge` (dev tooling only)

**Why it is vendored.** Upstream `tauri-plugin-mcp-bridge` 0.13.0 (the latest
release, and still the case on `main`) pins `webview2-com = "0.38"`. The Tauri
version this app uses (2.12, via `wry 0.57`) requires `webview2-com = "0.39"`.
Those are **semver-incompatible**, so cargo resolves *two* `webview2-com` crates
into the graph. The plugin then fails to compile:

```
error[E0277]: the trait bound `&IStream: Param<IStream, InterfaceType>` is not satisfied
   --> tauri-plugin-mcp-bridge-0.13.0/src/screenshot/windows.rs:58:26
```

The `ICoreWebView2*` types the plugin passes come from *its* `webview2-com 0.38`,
while the `IStream` it passes them to comes from *wry's* `webview2-com 0.39`.
They are different types, so the call does not type-check.

**What was changed.** Only the version pins, in `Cargo.toml`:

| dependency     | upstream | here   |
| -------------- | -------- | ------ |
| `webview2-com` | 0.38     | 0.39   |
| `windows`      | 0.61     | 0.62   |
| `windows-core` | 0.61     | 0.62   |

No source was modified. The APIs the plugin uses —
`CapturePreviewCompletedHandler` (present and identically shaped in both 0.38 and
0.39), `CreateStreamOnHGlobal`, `COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG` —
are unchanged across that boundary, which is why a pin bump is sufficient rather
than a port.

**Scope.** This crate is dev-only: it is behind the `mcp-bridge` cargo feature
(off by default) *and* `#[cfg(debug_assertions)]` in `lib.rs`, so it can never be
linked into a release build.

**Removing this vendor directory.** When upstream bumps to `webview2-com 0.39`,
delete this folder, drop `path = "vendor/tauri-plugin-mcp-bridge"` from the
`tauri-plugin-mcp-bridge` entry in `src-tauri/Cargo.toml`, and keep the version
requirement. Check with:

```bash
cargo tree -i webview2-com --features mcp-bridge
```

If that prints a single version, the vendor is no longer needed.
