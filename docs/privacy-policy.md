# SMEMaster Privacy Policy

**Effective date:** 2026-07-06

We wrote this in plain English because that's how we'd want to read it. If
something is unclear, email us — we'll fix the wording, not the meaning.

---

## The short version

SMEMaster is a **local-first** desktop application. Your email, contacts,
tasks, calendar, and attachments live on **your computer**, not on our
servers. We do not have a copy of your data, and we do not have the ability
to read it.

The only times SMEMaster talks to the internet on your behalf are:

1. To connect to your **own** email, contacts, and calendar providers
   (IMAP, SMTP, CalDAV, CardDAV, Microsoft Graph, Google APIs). Those
   connections are between you and the providers you configure. We do not
   proxy them.
2. To check for **software updates**. The auto-updater sends the current
   app version, the platform (Windows / macOS / Linux), and the channel
   (stable / beta) to our update server. Nothing else.
3. To download **PGP keys** from public keyservers (e.g. keys.openpgp.org)
   when you ask SMEMaster to look one up.

That's it.

---

## 1. Data we collect

**From your computer (in-app data, stored locally):**

- Email messages and metadata (sender, recipients, subject, body,
  attachments, headers, read/unread, flags, labels, folders).
- Contacts and contact groups.
- Calendar events and reminders.
- Tasks and notes.
- Email account configuration (provider, username, host, port) and
  authentication material (OAuth tokens, app passwords, PGP private keys,
  vault items). All stored in an encrypted local store.
- Application settings and preferences.

**From you to us (analytics, telemetry):**

- **None.** SMEMaster does not contain any analytics SDK, crash reporter,
  telemetry beacon, or tracking pixel. We do not measure feature usage,
  counts of emails sent, time spent in the app, or anything else.

**From the auto-updater to our update server:**

- App version
- Operating system and version
- CPU architecture
- Update channel (`stable` or `beta`)
- Hashed install ID (a random per-install UUID, used only to de-duplicate
  update checks; not tied to your email or your machine's hardware serial)

The auto-updater request looks like:

```
GET /update/<channel>/<arch>/<version>
User-Agent: SMEMaster/<version>
```

It does not include message content, your email address, or any of your
contacts.

---

## 2. Where your data is stored

**On your computer.** Specifically:

- A SQLite database inside the per-user app data directory
  (e.g. `%APPDATA%\com.smemaster.app` on Windows, or the app's
  scoped storage on Android).
- Local cached message bodies and attachments in the same directory.
- An encrypted keychain file (`keystore.db`) for credentials and PGP keys.
  The encryption key is derived from a passphrase you set during
  onboarding, or from your OS credential store if you opted in
  (Windows Credential Manager, Android Keystore).

We do not have a server. We do not have a cloud copy. If you delete
SMEMaster and the data directory, the data is gone.

If you choose to enable **encrypted backups** (Settings → Backup), the
backup file is also stored wherever **you** choose to put it — your local
disk, an external drive, your own cloud storage. We never see or touch the
backup file.

---

## 3. Third-party services we use

**None on the SMEMaster side.** We don't use any third-party analytics,
error tracking, marketing automation, customer support chat, or
advertising platform.

The third-party services you interact with are the ones **you** configure
inside SMEMaster, for example:

- Your email provider (Gmail, Outlook, Fastmail, your own IMAP server).
- Your contacts / calendar provider (Google, iCloud, Microsoft 365, your
  own CardDAV / CalDAV server).
- Optionally, a **public PGP keyservers** if you ask SMEMaster to fetch a
  key by email address or fingerprint.

Each of those services has its own privacy policy. We are not responsible
for what they do with the data you send them through SMEMaster. SMEMaster
acts as a **client** for those services; the data flows are between you
and the provider, not through us.

The update server (`releases.smemaster.app`) is operated by us, but the
only data it sees is the auto-updater request described above. Logs are
retained for 30 days, aggregated, and then deleted.

---

## 4. Your rights

You own your data. Specifically:

- **Export.** Settings → Backup → **Create backup** produces a single
  archive containing your entire SMEMaster state. You can also export
  contacts as `.vcf`, calendar as `.ics`, and email as `.mbox` or `.eml`
  on a per-folder basis.
- **Delete.** Settings → **Reset / delete all data** wipes the local
  database and keychain. This action is irreversible and we cannot undo
  it (we don't have a copy).
- **Uninstall.** Uninstalling the app does not delete the data directory
  by default. You can opt in to "remove everything on uninstall" in
  Settings → Privacy.
- **Access.** Because the data is local, "access" just means opening
  SMEMaster. You do not need to ask us for a copy.
- **Portability.** Use the export features above. All exports are in
  open formats (vCard 3.0, iCalendar 2.0, mbox, JSON).
- **Correction.** Edit your data inside the app. We have no copy to
  correct on our side.
- **Object / restrict / withdraw consent.** Disconnect an account in
  Settings → Accounts. The OAuth token is deleted from your local
  keychain and the connection is severed.

For users in the EU / EEA / UK, SMEMaster is the **data controller** for
the limited data we receive from the auto-updater. For all other data,
**you** are the data controller and SMEMaster acts as a processor on
your behalf, entirely on your device.

---

## 5. Children's data

SMEMaster is not directed at children under 13 (or under the age defined
as a minor in your jurisdiction). We do not knowingly collect data from
children. Because we don't collect data from anyone, the question is
mostly academic, but please don't install SMEMaster on a child's device
without parental controls in place.

---

## 6. Security

We protect the data on your machine with:

- AES-256-GCM encryption of the local keychain.
- OS credential-store integration on Windows (Credential Manager) and
  Android (Android Keystore).
- Argon2id for passphrase-derived keys.
- Strict CSP, no remote scripts, no remote fonts in the renderer.
- PGP key handling is done in Rust, with the OpenPGP crate, and private
  keys never leave the local keychain.
- All IPC is typed and validated against a strict schema (see
  `docs/03-FRONTEND/11-typed-ipc.md`).

For vulnerabilities, see our [Security Policy](../SECURITY.md). Please
**do not** open a public GitHub issue for a security problem.

---

## 7. Changes to this policy

If we change anything material — for example, if we ever add a telemetry
feature — we will:

1. Announce it in the release notes of the version that introduces the
   change.
2. Show an in-app banner that links to the new policy.
3. Wait at least 30 days before the change takes effect, so you can
   uninstall if you disagree.

Non-material changes (typos, clarifications, contact email updates) do
not trigger the above; we just update the document and bump the
"Last updated" date at the top.

---

## 8. Contact

For anything related to privacy, data, or this document:

- **Email:** privacy@smemaster.app
- **Mailing address:** SMEMaster Inc., [street], [city], [country]
- **Security disclosures:** security@smemaster.app (see SECURITY.md for
  the PGP key)

We respond to privacy requests within 30 days.

---

_This document is provided in English. Translations are available in
`docs/i18n/privacy-policy.<lang>.md` and are provided for convenience
only; in case of conflict, the English version applies._
