# SMEMaster — Frequently Asked Questions

## General

### Is my data stored in the cloud?
No. SMEMaster is a local-first application. All your data is stored on your computer. Your emails are fetched from your email provider and stored locally. Nothing is sent to SMEMaster servers.

### Is SMEMaster free?
SMEMaster is free and open-source software. There are no subscriptions, no paid tiers, and no data selling.

### Which platforms are supported?
Windows (MSI/NSIS), macOS (DMG), and Linux (AppImage/DEB).

## Email

### How do I add my email account?
See the [Account Setup Guide](account-setup.md) for detailed instructions for each provider.

### Can I use SMEMaster with multiple email accounts?
Yes. You can add unlimited email accounts. Each account syncs independently.

### What happens when I'm offline?
SMEMaster works fully offline. Emails you compose while offline are queued and sent automatically when you reconnect.

### Are my email credentials secure?
Yes. All credentials are encrypted using AES-256-GCM before storage. The encryption key is derived at runtime and never stored in the app bundle.

## PGP Encryption

### How do I set up PGP?
See the [PGP Setup Guide](pgp-setup.md) for detailed instructions.

### Can I import existing PGP keys?
Yes. SMEMaster supports importing PGP keys in ASCII-armored format.

## Troubleshooting

### The app crashed. What should I do?
1. Restart SMEMaster
2. If the problem persists, check for crash logs in:
   - Windows: `%APPDATA%/com.smemaster.app/crash.log`
   - macOS: `~/Library/Application Support/com.smemaster.app/crash.log`
   - Linux: `~/.local/share/com.smemaster.app/crash.log`
3. Report the issue on [GitHub](https://github.com/smemaster/smemaster/issues)

### My emails are not syncing
1. Check your internet connection
2. Go to Settings → Accounts → select your account
3. Click "Sync Now"
4. If the problem persists, remove and re-add the account

### How do I export my data?
Go to Settings → Security & Data → Export. You can export:
- Contacts as CSV
- Emails as MBOX
- Campaigns as JSON
- Tasks as CSV
- Calendar as ICS