# SMEMaster Beta Test Scenarios

These 8 scenarios are the **minimum required script** for the closed beta. A
tester who finishes all 8 has exercised every critical user journey at least
once. Use them as-is; do not invent extra flows during the week.

For each scenario, the tester fills out one `feedback.md` form. Time starts when
the scenario is read out loud, and stops when the final expected output is
visible on screen.

---

## Scenario 1 — Onboard from scratch

**Goal:** Validate the very first experience for a brand-new user.

**Pre-condition:** A clean machine that has never had SMEMaster installed.

**Steps:**

1. Download the installer for your platform from the link the beta lead sent.
2. Install SMEMaster.
3. Launch the app.
4. Complete the onboarding wizard (welcome → preferences → first account).
5. Add your **first** email account using the OAuth flow if available, IMAP
   credentials otherwise.
6. Wait for the initial sync to complete.
7. Open the inbox and confirm at least one email is visible.

**Expected outcome:** A working inbox with the first message visible, the
welcome tour completed, no crashes.

**Common failure modes to watch for:** installer permission prompts on
Windows / macOS, OAuth callback window doesn't open, IMAP autodiscovery
returns a wrong server, sync never finishes (watch the sync indicator for
> 2 minutes).

---

## Scenario 2 — Daily email flow

**Goal:** Simulate one realistic morning of triage.

**Pre-condition:** At least 5 unread emails in the inbox from Scenario 1.

**Steps:**

1. Receive (or arrange to be sent) **5 new emails** during the test session.
2. Triage the 5: open the important ones, mark the rest as read from the list.
3. **Reply to 2** of them using the reply button.
4. **Archive 2** of them using the keyboard shortcut.
5. Confirm the unread count drops to the expected number.

**Expected outcome:** Unread count = 5 − (opened + manually marked read),
2 replies land in the Sent folder, 2 messages are in Archive.

**Common failure modes:** reply opens a new composer instead of pre-filling the
quoted original, archive keyboard shortcut is intercepted by the OS, sent
message is duplicated in the outbox.

---

## Scenario 3 — Contact management

**Goal:** Validate the CRM-lite path.

**Pre-condition:** None.

**Steps:**

1. Open the Contacts view.
2. **Add 3 contacts** by hand. Use realistic data: name, email, phone,
   company, notes.
3. Create 1 **group** (e.g. "Beta testers") and add 2 of the contacts to it.
4. Apply at least 1 **tag** to each contact.
5. Export the group as a `.vcf` (vCard) file.
6. Import the same `.vcf` into the system Contacts app (macOS Contacts,
   Google Contacts, or Windows People) and confirm the fields round-trip.

**Expected outcome:** Round-tripped vCard contains the same email, phone, name
fields. Group membership and tags are SMEMaster-side only — the tester
verifies they are visible in the UI.

**Common failure modes:** vCard encoding drops the notes field, UTF-8 names
get mangled, group re-imports as individual contacts.

---

## Scenario 4 — Task workflow

**Goal:** Validate the task manager end to end.

**Pre-condition:** None.

**Steps:**

1. Open the Tasks view.
2. **Create 5 tasks** with varying priorities and due dates (some today, some
   this week, some with no due date).
3. Mark **2 of them** as Done.
4. Use the search bar to find the remaining 3 by title keyword.
5. Mark the remaining 3 as Done.
6. Open the Completed view and confirm all 5 are listed.

**Expected outcome:** Toast notification fires on each "Done" click. Completed
view shows all 5 tasks, sortable by completion date.

**Common failure modes:** toast doesn't appear, completed task disappears from
the active list but is missing from the Completed view, search is case-
sensitive, due date is off by one timezone.

---

## Scenario 5 — Calendar event

**Goal:** Validate the calendar export / import story.

**Pre-condition:** None.

**Steps:**

1. Open the Calendar view.
2. Switch to **Week view**.
3. Create a new event with a title, start time, end time, and one reminder.
4. Export the event as `.ics`.
5. Open the `.ics` file and confirm the fields are present in plain text.
6. Import it into **Apple Calendar** (macOS / iOS) **or** **Google Calendar**
   (whichever the tester has).
7. Confirm the event appears at the right local time and the reminder fires.

**Expected outcome:** Event lands in the external calendar with the exact
title, time (in the tester's local zone), and a working reminder.

**Common failure modes:** times exported as UTC without a `TZID`, reminder is
silently dropped, recurrence rule is malformed, long titles are truncated.

---

## Scenario 6 — Backup and restore

**Goal:** Validate that the user can self-recover from a disaster.

**Pre-condition:** At least one email account set up, a few contacts, a few
tasks.

**Steps:**

1. Open Settings → Backup.
2. Click **Create backup now**. Wait for the file to finish writing.
3. Verify the file is non-zero size, has a `.smemaster-backup` or `.zip`
   extension, and is timestamped.
4. Note the path.
5. Delete a contact to simulate data loss.
6. Open Settings → Backup → **Restore from file**.
7. Pick the file from step 2.
8. Confirm the deleted contact reappears.
9. Confirm the email account is still configured (you should not have to
   re-enter the password — the OAuth token should round-trip).

**Expected outcome:** Full state restored, including accounts, contacts,
tasks, calendar events, smart folders, signatures.

**Common failure modes:** OAuth token is not in the backup (user has to
re-auth), backup silently fails on a non-ASCII path, restore overwrites a
newer state.

---

## Scenario 7 — Offline mode

**Goal:** Validate the offline send queue.

**Pre-condition:** At least one email account set up, network online.

**Steps:**

1. Open the composer and start drafting an email.
2. **Disconnect from the network** (turn off Wi-Fi, unplug ethernet, or use
   the OS network kill-switch).
3. Click **Send**. Expect a banner or toast: "Queued, will send when online."
4. Stay offline for at least 60 seconds.
5. **Reconnect.**
6. Watch the queue progress indicator.
7. Confirm the email leaves the outbox and the recipient (tester's second
   account) receives it.

**Expected outcome:** Email arrives at the recipient within 2 minutes of
reconnect. No duplicate send. No data loss in the draft.

**Common failure modes:** composer refuses to send offline, message lost on
reconnect, multiple sends (retry loop with no backoff), no user-visible
feedback that the message is queued.

---

## Scenario 8 — Crash recovery

**Goal:** Validate that the local state survives an unclean shutdown.

**Pre-condition:** A draft email with at least 200 characters of body text
and 1 attachment.

**Steps:**

1. Open a draft with content.
2. **Force-kill the app** mid-typing. On Windows: Task Manager → End task.
   On macOS: Activity Monitor → Force quit. On Linux: `kill -9`.
3. Relaunch SMEMaster.
4. Open the draft — content must still be there, attachment still linked.
5. Open the inbox — unread counts and flags must be exactly as they were
   before the kill.
6. Open Settings → About → check the local database integrity (should
   report OK).
7. Repeat the kill while a send is in flight (in the queued state from
   Scenario 7). Relaunch and confirm the send either completes or stays
   queued — it must not silently disappear.

**Expected outcome:** No data loss. SQLite WAL is replayed correctly. No
corruption report from the integrity check.

**Common failure modes:** draft content is lost, attachment is unlinked,
inbox flags reset, database integrity check reports corruption, in-flight
send vanishes from the queue.

---

## Out-of-scope for this beta

The following are explicitly **not** tested here and are tracked in the
internal dogfooding program instead:

- Mobile (Android / iOS) install
- Device pairing between two machines
- Campaign warmup generator
- AI provider configuration
- License activation and upgrade flows

These are covered by their own gates.
