# SMEMaster — Backup & Restore Guide

## Automatic Backups

SMEMaster automatically backs up your data every 24 hours. Backups are stored in the app data directory and are retained for 7 days by default.

### Configuring Backups

1. Open Settings → Security & Data → Backup
2. Toggle automatic backups on/off
3. Set the backup interval (default: 24 hours)
4. Set the retention count (default: 7 backups)
5. Choose a custom backup destination (optional)

### Manual Backup

1. Open Settings → Security & Data → Backup
2. Click "Back Up Now"
3. The backup will be created immediately

## Restoring from Backup

1. Open Settings → Security & Data → Backup
2. Click "Restore from Backup"
3. Select a backup file from the list
4. Confirm by typing "RESTORE"
5. Wait for the restore to complete
6. The app will restart automatically

## Backup Integrity

SMEMaster verifies backup integrity using SHA-256 hash verification:
- Each backup file has a corresponding `.sha256` hash file
- Before restoring, the hash is verified to ensure the backup is not corrupted
- If the hash check fails, the restore is aborted with a clear error message

## Where Are Backups Stored?

- **Default location**: `{app_data_dir}/backups/`
- To find your app data directory:
  - Windows: `%APPDATA%/com.smemaster.app/backups/`
  - macOS: `~/Library/Application Support/com.smemaster.app/backups/`
  - Linux: `~/.local/share/com.smemaster.app/backups/`
- You can change the backup destination in Settings