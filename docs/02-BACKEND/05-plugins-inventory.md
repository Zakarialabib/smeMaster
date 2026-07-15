# Plugin Inventory (15 Tauri Plugins)

**What you need to know:** These are the Tauri plugins I'm currently using. Some are critical (deep-link, single-instance), some are nice-to-have (clipboard, window-state), and a few have caveats on mobile. I've removed several plugins that were either unused or replaced by Rust-native alternatives.

| Plugin                           | Version | What it does                       | Mobile?                |
| -------------------------------- | ------- | ---------------------------------- | ---------------------- |
| `tauri-plugin-single-instance`   | 2.4.2   | Only one app instance              | ✅ No-op               |
| `tauri-plugin-deep-link`         | 2.4.9   | `mailto:` + OAuth callback scheme  | ⚠️ Needs mobile scheme |
| `tauri-plugin-log`               | 2.8.0   | Logging (Android Logcat + desktop) | ✅                     |
| `tauri-plugin-notification`      | 2.3.3   | OS notifications                   | ✅ Different API       |
| `tauri-plugin-opener`            | 2.5.4   | Open URLs in system browser        | ✅                     |
| `tauri-plugin-dialog`            | 2.7.1   | File save/open dialogs             | ⚠️ Partial             |
| `tauri-plugin-fs`                | 2.5.1   | File system access                 | ⚠️ Scoped              |
| `tauri-plugin-updater`           | 2.10.1  | App updates (feature-gated)        | ❌                     |
| `tauri-plugin-persisted-scope`   | 2.3.7   | Persist FS scope permissions       | ✅                     |
| `tauri-plugin-biometric`         | 2.3.2   | Biometric auth (vault PIN)         | ✅                     |
| `tauri-plugin-window-state`      | 2.4.1   | Save/restore window position       | ✅                     |
| `tauri-plugin-clipboard-manager` | 2.3.2   | Clipboard read/write               | ✅                     |
| `tauri-plugin-global-shortcut`  | 2.2.1   | Global keyboard shortcuts          | ✅ Registered in `lib.rs` (do NOT remove) |
| `tauri-plugin-store`            | 2.4.2   | Key–value persisted store          | ✅                     |

**Previously removed** (replaced or unnecessary):

- `tauri-plugin-sql` — swapped for Rust `sqlx`
- `autostart`, `http`, `process`, `os` — just didn't need them (note: `global-shortcut` is **NOT** in this list — it is still used and registered in `lib.rs`)

## Gotchas I learned the hard way

- **Single instance** must be registered FIRST, before any other plugin. See `src-tauri/src/lib.rs:67`.
- **Updater** is gated behind `cfg(feature = "updater")`. Not always enabled because I don't want to ship updates before they're ready.
- **SQL plugin `preload`** must be an array: `["sqlite:smemaster.db"]`. NOT an object or map. Lost an afternoon to that.
- **Emitter trait** — you need `use tauri::Emitter;` to call `.emit()` on windows. Easy to miss.
- **Capabilities** — new plugins need explicit permissions in `src-tauri/capabilities/default.json`. It's not automatic.
- **CSP whitelist** — googleapis, anthropic, openai, gemini, gravatar, localhost (Ollama, LM Studio). Update this if you add a new external API.
- **Windows AUMID** — set explicitly to `com.smemaster.app`. Required for notifications on Windows.
