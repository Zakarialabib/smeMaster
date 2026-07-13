# User Guide — Automation (Visual Workflow Builder)

Automation lets SMEMaster handle repetitive email and task work for you. A rule
is: **when something happens → (optionally, if a condition matches) → do these
actions.**

## Open it

Go to **Automation** in the sidebar. You'll see your rules as cards (or a list,
toggle top-right). Each rule has an on/off switch and a delete button.

## Create a rule (Simple mode)

1. Click **+ New Rule** (or **Visual Builder** for the canvas).
2. **Name** the rule.
3. Pick a **Trigger**:
   - *Email Received* — add a condition: **From domain** (e.g. `supplier.com`)
     and/or **Subject contains** a keyword.
   - *No Reply After Days* — set how many days without a reply.
   - *Time Based* — enter a cron expression (`0 9 * * 1` = every Monday 09:00).
   - *Label Applied* / *Email Starred* — fire on any email.
4. Click **+ Add Action** and choose one or more:
   - Apply Label, Send Template, Create Task (with a due-in-N-days), Mark Read,
     Archive, Star, Forward To, Send Notification.
5. **Save**. The rule runs automatically on matching emails.

## Visual Builder

The **Visual Builder** opens a node canvas (React Flow): a green **Trigger** node
at the top, an optional **Condition** node in the middle (only if you set
conditions), and one **Action** node per action, connected top-to-bottom. It's
the same rule shown graphically — great for presenting or checking a flow.

## Let AI write it

Click the **Sparkles** button and describe the rule in plain language (e.g.
"When I get an email from my supplier, label it and create a follow-up task").
The AI drafts the trigger and actions; review and save.

## Tips

- Inactive rules never run — use the toggle to pause without deleting.
- One action type can't appear twice in the same rule.
- Time-based rules need a valid cron expression.
