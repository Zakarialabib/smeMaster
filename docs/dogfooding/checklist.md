# SMEMaster Dogfooding Daily Checklist

Use SMEMaster as your real tool for the next 7 days. Run through this checklist
**every workday** to make sure every major code path actually gets exercised.

The checklist is intentionally short — under 5 minutes — so it never feels like
"work" on top of the day. If something on the list doesn't apply (e.g. you don't
have an email account set up yet), set it up that day. The point is to keep the
core flows alive in the database.

---

## Daily checklist

Tick each box after you complete the action. Note the time you spent in the log
file (`log.md`).

### Email

- [ ] **Send 1 email** — to a real person, real content, real subject.
- [ ] **Reply to 1 email** — use the reply button, not the composer from scratch.
- [ ] **Mark 1 email as read** — either open it or use the keyboard shortcut.
- [ ] **Archive 1 email** — same, keyboard shortcut preferred.

### Contacts

- [ ] **Add 1 contact** — from a real signature, business card, or phone call.

### Tasks

- [ ] **Add 1 task** — something you actually need to do this week.
- [ ] **Complete 1 task** — and watch the toast notification fire.

### Search

- [ ] **Search for 1 email** — by sender, subject, or body keyword.

### Keyboard

- [ ] **Use a keyboard shortcut 5 times** — count them. Pick whichever shortcuts
  feel natural (archive, mark read, compose, navigate inbox). The goal is to
  make the shortcuts muscle memory.

### Notifications

- [ ] **Check the notification toast system** — at least one toast should have
  appeared during the day. Verify the animation, the action buttons, the
  auto-dismiss timer, and the queue (do not pile up unread).

---

## Optional weekly extras

Do these at least once during the week:

- [ ] Search for a contact by name
- [ ] Create a calendar event
- [ ] Trigger a manual backup from Settings
- [ ] Kill the app mid-compose, reopen, verify the draft is still there
- [ ] Toggle the theme between light, dark, and system
- [ ] Switch UI language

---

## When something breaks

1. Note it in `log.md` under **What broke** with the exact steps to reproduce.
2. Check the dev console / `smemaster.log` and grab a snippet.
3. File an issue with label `dogfooding` and link this log day in the body.
4. Do not work around the bug silently — we need the friction to be visible.

---

## When you can't finish a checklist item

That itself is feedback. Write in the log:

> "Skipped: send 1 email — draft kept failing to open after ~30 s"

That's more valuable than a green tick.
