export interface DemoScreen {
  title: string;
  description: string;
  simulatedAction: string;
  duration: number;
}

export interface TemplateDemo {
  id: string;
  templateIds: string[];
  name: string;
  duration: number;
  screens: DemoScreen[];
}

export const DEMO_FOLLOW_UP: TemplateDemo = {
  id: "demo-followup",
  templateIds: ["preset-followup", "preset-meeting"],
  name: "Follow-Up Template Demo",
  duration: 45,
  screens: [
    { title: "Email arrives", description: "Sarah from Acme Corp emails you about Q2 pricing", simulatedAction: "📩 Incoming email from sarah@acme.com", duration: 3000 },
    { title: "AI analyzes", description: "SMEMaster reads the email and understands it's a sales inquiry", simulatedAction: "🧠 AI categorizing: Sales Lead", duration: 2000 },
    { title: "Template suggested", description: "The Follow-Up template is automatically suggested", simulatedAction: "📋 Template: Follow-Up selected", duration: 2000 },
    { title: "AI drafts reply", description: "AI generates a personalized reply using your writing style", simulatedAction: "✍️ AI drafting reply...", duration: 3000 },
    { title: "Compliance check", description: "CAN-SPAM compliance verified, unsubscribe link added", simulatedAction: "✅ Compliance: All clear", duration: 2000 },
    { title: "Email sent", description: "Your reply is ready. Click send or customize further.", simulatedAction: "📨 Reply drafted. 5 minutes saved!", duration: 3000 },
  ],
};

export const DEMO_CAMPAIGN_LAUNCH: TemplateDemo = {
  id: "demo-campaign-launch",
  templateIds: ["preset-announcement", "preset-promotion"],
  name: "Campaign Launch Demo",
  duration: 60,
  screens: [
    { title: "Campaign wizard opens", description: "Create a new campaign for your product launch", simulatedAction: "📝 Campaign: Product Launch created", duration: 3000 },
    { title: "AI suggests subject", description: "AI generates 3 subject line variants based on your content", simulatedAction: "🤖 AI Subject: 'Introducing SMEMaster 2.0 – What's New'", duration: 3000 },
    { title: "A/B test configured", description: "Two subject variants will be tested automatically", simulatedAction: "🔬 A/B Test: 50/50 split configured", duration: 2500 },
    { title: "Segment selected", description: "Choose your audience from your contact segments", simulatedAction: "👥 Segment: Enterprise Customers (47 contacts)", duration: 2500 },
    { title: "Warming scheduled", description: "30-day warmup configured for your sending domain", simulatedAction: "🌡️ Warming: Auto-configured (30-day ramp)", duration: 3000 },
    { title: "Compliance verified", description: "CAN-SPAM and GDPR checks passed automatically", simulatedAction: "✅ Compliance: CAN-SPAM + GDPR OK", duration: 2000 },
    { title: "Voice approval", description: "47 emails queued. Say 'launch' to proceed.", simulatedAction: "🎙️ Voice approval: 'Launch' detected – deploying", duration: 3000 },
    { title: "Analytics dashboard", description: "Real-time open and click tracking as emails go out", simulatedAction: "📊 Avg. open rate: 28% for campaigns using this template", duration: 3000 },
  ],
};

// ── Signature Demos ────────────────────────────────────────────

export const DEMO_SIGNATURE_MODERN: TemplateDemo = {
  id: "demo-signature-modern",
  templateIds: [],
  name: "Modern Signature Demo",
  duration: 50,
  screens: [
    { title: "Signature editor opens", description: "Navigate to Settings > Signatures and click 'Create New'", simulatedAction: "📝 Signature editor launched", duration: 2500 },
    { title: "AI suggests layout", description: "AI recommends a modern layout with name, title, and company on separate lines", simulatedAction: "🤖 AI layout: Modern (3-line header)", duration: 2000 },
    { title: "Enter personal info", description: "Type your full name, job title, and company name into the fields", simulatedAction: "👤 John Smith | CEO | Acme Corp", duration: 3000 },
    { title: "Contact details added", description: "Phone number, email, and website are auto-filled from your profile", simulatedAction: "📞 +1 (555) 123-4567 · john@acme.com · acme.com", duration: 2500 },
    { title: "Style picker", description: "Choose between divider styles — line, space, or minimalist dot separator", simulatedAction: "🎨 Style: Thin line divider selected", duration: 2000 },
    { title: "Live preview", description: "See a real-time preview of how your signature looks in an email", simulatedAction: "👁️ Preview: Clean modern layout with subtle divider", duration: 2500 },
    { title: "Signature saved", description: "Signature is saved and set as default for your primary account", simulatedAction: "✅ 'Modern Professional' saved · Set as default", duration: 2000 },
  ],
};

export const DEMO_SIGNATURE_BRANDED: TemplateDemo = {
  id: "demo-signature-branded",
  templateIds: [],
  name: "Branded Signature Demo",
  duration: 55,
  screens: [
    { title: "Branded signature wizard", description: "Open the branded signature builder from the templates panel", simulatedAction: "🏷️ Branded Signature Wizard opened", duration: 2500 },
    { title: "Upload company logo", description: "Drag-and-drop your company logo into the signature editor", simulatedAction: "🖼️ Logo uploaded: acme-logo.png (120×40px)", duration: 3000 },
    { title: "Brand colors detected", description: "AI extracts your company brand colors from the logo", simulatedAction: "🎨 Brand colors: #2563EB · #1E40AF · #F59E0B", duration: 2500 },
    { title: "Social links configured", description: "Add LinkedIn, Twitter, and company Facebook page links", simulatedAction: "🔗 LinkedIn · Twitter · Facebook links added", duration: 2500 },
    { title: "Banner graphic inserted", description: "Optional promotional banner with your latest campaign CTA", simulatedAction: "📢 Banner: 'Check out our Q2 Product Launch'", duration: 2000 },
    { title: "Legal footer appended", description: "Confidentiality notice and unsubscribe link appended automatically", simulatedAction: "⚖️ Legal footer: Confidentiality + CAN-SPAM compliant", duration: 2000 },
    { title: "Multi-account assign", description: "Assign this branded signature to all company-managed accounts", simulatedAction: "📎 Applied to 3 accounts · 2 team members", duration: 3000 },
    { title: "Signature deployed", description: "Branded signature goes live across all outgoing emails", simulatedAction: "✅ 'Acme Branded' deployed to all accounts", duration: 2000 },
  ],
};

export const DEMO_SIGNATURE_MINIMAL: TemplateDemo = {
  id: "demo-signature-minimal",
  templateIds: [],
  name: "Minimal Signature Demo",
  duration: 35,
  screens: [
    { title: "Minimal mode selected", description: "Choose the 'Minimal' template from the signature gallery", simulatedAction: "📋 Template: Minimal selected", duration: 2000 },
    { title: "Name only layout", description: "Just your name in a clean sans-serif font — no clutter", simulatedAction: "✒️ Name set: Alex Chen", duration: 2000 },
    { title: "Single link added", description: "Optionally add one link — LinkedIn profile or personal site", simulatedAction: "🔗 Link: linkedin.com/in/alexchen", duration: 2000 },
    { title: "Font and size tuned", description: "Adjust font to Inter 14px for perfect mobile readability", simulatedAction: "🔤 Font: Inter · Size: 14px · Color: #374151", duration: 2000 },
    { title: "Mobile preview", description: "Check how the signature renders on iOS and Android email clients", simulatedAction: "📱 Mobile preview: Clean, no horizontal scroll", duration: 2500 },
    { title: "Saved and active", description: "Minimal signature saved with zero friction", simulatedAction: "✅ 'Minimal Chen' saved — 2 taps to deploy", duration: 2000 },
  ],
};

// ── Workflow Demos ────────────────────────────────────────────

export const DEMO_WORKFLOW_AUTO_REPLY: TemplateDemo = {
  id: "demo-workflow-auto-reply",
  templateIds: ["auto-reply-vacation", "followup-3-days"],
  name: "Auto-Reply Workflow Demo",
  duration: 50,
  screens: [
    { title: "Workflow builder opens", description: "Navigate to Automation > Workflows and click 'New Workflow'", simulatedAction: "⚡ Workflow Builder opened", duration: 2500 },
    { title: "Trigger selected", description: "Choose 'Email Received' as the trigger event", simulatedAction: "📥 Trigger: Email Received", duration: 2000 },
    { title: "Condition configured", description: "Set conditions — only trigger during office hours, exclude existing threads", simulatedAction: "🔍 Conditions: Office hours only · New threads", duration: 2500 },
    { title: "Action: auto-reply", description: "Select 'Send Template Reply' action and pick the vacation template", simulatedAction: "✉️ Action: Send 'Vacation Auto-Reply' template", duration: 2500 },
    { title: "Sender filter", description: "Optionally restrict to contacts only (skip strangers)", simulatedAction: "👥 Filter: Known senders only", duration: 2000 },
    { title: "AI reviews logic", description: "AI suggests adding a 'no-reply follow-up' fallback for urgent senders", simulatedAction: "🤖 AI suggestion: Add urgent fallback path", duration: 3000 },
    { title: "Workflow activated", description: "Workflow saved and enabled — toggle to pause anytime", simulatedAction: "✅ 'Auto-Reply OOO' activated · 12:00–18:00 daily", duration: 2500 },
  ],
};

export const DEMO_WORKFLOW_FOLLOWUP: TemplateDemo = {
  id: "demo-workflow-followup",
  templateIds: ["followup-3-days", "flag-overdue-replies"],
  name: "Follow-Up Workflow Demo",
  duration: 55,
  screens: [
    { title: "Follow-up workflow", description: "Open the follow-up automation template from the gallery", simulatedAction: "📋 Workflow: Follow-Up After No Reply", duration: 2000 },
    { title: "Delay configured", description: "Set the wait period to 3 days after your last sent email", simulatedAction: "⏳ Wait: 3 days after last sent email", duration: 2500 },
    { title: "Follow-up template chosen", description: "Pick the 'Gentle Nudge' preset as the follow-up email template", simulatedAction: "📝 Template: 'Gentle Nudge' selected", duration: 2000 },
    { title: "Max follow-ups set", description: "Limit to 2 follow-ups maximum to avoid over-contacting", simulatedAction: "🔁 Max follow-ups: 2 · Spacing: 4 days apart", duration: 2000 },
    { title: "Task creation on exhaustion", description: "After max follow-ups, create a task to review the thread manually", simulatedAction: "📌 Fallback: Create task 'Review cold thread'", duration: 2500 },
    { title: "AI personalization", description: "AI will personalize each follow-up using the original thread context", simulatedAction: "🤖 AI personalization: On (references prior emails)", duration: 2500 },
    { title: "Workflow deployed", description: "Follow-up sequence is live and monitoring all outbound emails", simulatedAction: "✅ 'Follow-Up Sequence' active on 3 accounts", duration: 2000 },
  ],
};

export const DEMO_WORKFLOW_LABELING: TemplateDemo = {
  id: "demo-workflow-labeling",
  templateIds: ["flag-invoices", "ai-smart-categorization"],
  name: "Smart Labeling Workflow Demo",
  duration: 50,
  screens: [
    { title: "Smart labeling workflow", description: "Create a new automation for intelligent email classification", simulatedAction: "🏷️ Smart Labeling Workflow started", duration: 2000 },
    { title: "AI category detection", description: "AI scans incoming emails and categorizes them (invoice, support, newsletter)", simulatedAction: "🧠 AI categories: Invoice · Support · Newsletter · Social", duration: 2500 },
    { title: "Label mapping", description: "Map each AI category to a Gmail-style label or folder", simulatedAction: "📑 Labels: INVOICE → Red · SUPPORT → Blue · SOCIAL → Grey", duration: 2500 },
    { title: "Forward rule added", description: "Configure forwarding for support-labeled emails to the support team", simulatedAction: "↪️ Forward: Support → team@support.acme.com", duration: 2500 },
    { title: "Archive condition", description: "Auto-archive newsletters and social notifications after labeling", simulatedAction: "📦 Archive: Newsletters + Social auto-archived", duration: 2000 },
    { title: "AI confidence threshold", description: "Set confidence threshold (85%) — below threshold emails go to manual review", simulatedAction: "📊 Confidence: ≥85% auto · <85% → Review folder", duration: 2500 },
    { title: "Workflow live", description: "Workflow running — labels applied in real-time as emails arrive", simulatedAction: "✅ Smart Labeling active · 142 emails processed today", duration: 2500 },
  ],
};

// ── Warmup Demos ──────────────────────────────────────────────

export const DEMO_WARMUP_BASICS: TemplateDemo = {
  id: "demo-warmup-basics",
  templateIds: ["warmup-followup-1", "warmup-intro-1"],
  name: "Warmup Basics Demo",
  duration: 40,
  screens: [
    { title: "Warmup panel opens", description: "Go to Sending > Warmup and click 'Start Warming'", simulatedAction: "🌡️ Warmup Panel opened", duration: 2000 },
    { title: "Sender selected", description: "Choose the email account you want to warm up", simulatedAction: "📧 Account: john@acme.com selected", duration: 2000 },
    { title: "Warmup style chosen", description: "Pick 'Follow-Up' style — safe, natural-looking replies to your own thread", simulatedAction: "🎯 Style: Follow-Up (recommended for new senders)", duration: 2500 },
    { title: "Daily volume set", description: "Start at 3 emails/day with automatic ramp-up over 30 days", simulatedAction: "📈 Volume: 3/day → ramp to 20/day (30-day plan)", duration: 2500 },
    { title: "Template pool attached", description: "Attach 4 follow-up templates for variety in warmup messages", simulatedAction: "📋 Template pool: 4 follow-up variants attached", duration: 2000 },
    { title: "Warmup activated", description: "Warming begins — first batch goes out within the next hour", simulatedAction: "✅ Warming active · first send in 45 minutes", duration: 2000 },
  ],
};

export const DEMO_WARMUP_PROGRESS: TemplateDemo = {
  id: "demo-warmup-progress",
  templateIds: ["warmup-meeting-1", "warmup-checkin-1", "warmup-sharing-1"],
  name: "Warmup Progress Demo",
  duration: 45,
  screens: [
    { title: "Warmup dashboard", description: "Open the sender health dashboard to view warmup progress", simulatedAction: "📊 Warmup Dashboard loaded", duration: 2000 },
    { title: "Daily stats reviewed", description: "Check today's sent volume, reply rate, and bounce rate", simulatedAction: "📅 Today: 12 sent · 3 replies · 0 bounces", duration: 2500 },
    { title: "Volume ramp chart", description: "View the ramp-up curve — volume increases week over week", simulatedAction: "📈 Ramp: Week 1 (3/d) → Week 2 (6/d) → Week 3 (12/d)", duration: 2500 },
    { title: "Sender score displayed", description: "SMEMaster assigns a sender reputation score based on engagement", simulatedAction: "⭐ Sender Score: 82/100 (Good — 4 more days to Excellent)", duration: 2500 },
    { title: "Content variety rotation", description: "Add meeting and check-in styles to keep warmup messages diverse", simulatedAction: "🔄 Content mix: Follow-up 60% · Meeting 25% · Check-in 15%", duration: 2500 },
    { title: "Pause or adjust", description: "Pause warming if reply rates dip — AI suggests optimal adjustments", simulatedAction: "⏸️ Paused · AI suggests reducing to 8/day for 2 days", duration: 2500 },
    { title: "Progress snapshot", description: "Full warmup summary with projected completion date", simulatedAction: "✅ 78% complete · Estimated finish: June 12", duration: 2000 },
  ],
};

// ── Template Demos (new) ──────────────────────────────────────

export const DEMO_TEMPLATE_NEWSLETTER: TemplateDemo = {
  id: "demo-template-newsletter",
  templateIds: ["preset-welcome-onboard", "preset-team-update"],
  name: "Newsletter Template Demo",
  duration: 55,
  screens: [
    { title: "Template chooser opens", description: "Click 'New Campaign' and browse the template gallery for newsletters", simulatedAction: "📋 Template Gallery: Newsletter section", duration: 2000 },
    { title: "AI suggests subject", description: "AI generates 3 subject line variants based on your newsletter content", simulatedAction: "🤖 Subject options: 'May Product Updates' · 'What's New at Acme' · 'Your Monthly Digest'", duration: 3000 },
    { title: "Structure selected", description: "Pick a 2-column layout with hero image and article cards", simulatedAction: "📐 Layout: Hero + 2-col cards selected", duration: 2500 },
    { title: "Template inserted", description: "Newsletter template with pre-built sections is inserted into the editor", simulatedAction: "📄 Template inserted: Intro · Feature · Tip · CTA sections", duration: 2500 },
    { title: "AI personalizes content", description: "AI pulls recent company updates and tailors the content per segment", simulatedAction: "✍️ Personalized: Enterprise segment sees advanced features", duration: 3000 },
    { title: "Preview & test", description: "Send test emails — preview renders on desktop, mobile, and Outlook", simulatedAction: "📱 Preview: Desktop ✓ · Mobile ✓ · Outlook ✓", duration: 2500 },
    { title: "Campaign scheduled", description: "Schedule the newsletter for Tuesday 10 AM — optimal open time", simulatedAction: "📅 Scheduled: Tuesday 10:00 AM · 1,247 recipients", duration: 2500 },
    { title: "Analytics preview", description: "Estimated open rate and click-rate shown before launch", simulatedAction: "📊 Est. open rate: 32% · Est. click rate: 5.8%", duration: 2000 },
  ],
};

export const DEMO_TEMPLATE_INVOICE: TemplateDemo = {
  id: "demo-template-invoice",
  templateIds: ["preset-proposal", "preset-renewal-reminder"],
  name: "Invoice Template Demo",
  duration: 50,
  screens: [
    { title: "Invoice template opens", description: "Open the Invoice template from the Business category", simulatedAction: "📋 Template: Invoice (Business category)", duration: 2000 },
    { title: "Variable placeholders shown", description: "Template contains variables for invoice #, amount, due date, and payment link", simulatedAction: "🔤 Variables: {{invoice_number}}, {{amount}}, {{due_date}}, {{payment_link}}", duration: 3000 },
    { title: "AI auto-maps data", description: "AI detects CRM invoice fields and pre-maps them to template variables", simulatedAction: "🤖 Auto-mapped: 6 of 8 variables matched from CRM", duration: 2500 },
    { title: "Manual variable insert", description: "Insert custom variable {{purchase_order}} directly into the template body", simulatedAction: "✏️ Custom variable inserted: {{purchase_order}}", duration: 2500 },
    { title: "Preview with live data", description: "Preview the template with real invoice data from your latest record", simulatedAction: "👁️ Live preview: Invoice #1042 · $4,250.00 · Due June 15, 2026", duration: 2500 },
    { title: "Compliance check", description: "Invoice template passes compliance — payment terms and legal footer verified", simulatedAction: "✅ Compliance: Payment terms OK · Legal footer present", duration: 2000 },
    { title: "Sent with tracking", description: "Invoice sent with read receipt and payment status tracking", simulatedAction: "📨 Sent to client@example.com · Payment tracking active", duration: 2500 },
  ],
};

// ── All Demos Registry ────────────────────────────────────────

export const ALL_DEMOS: TemplateDemo[] = [
  // Original demos
  DEMO_FOLLOW_UP,
  DEMO_CAMPAIGN_LAUNCH,

  // Signature demos
  DEMO_SIGNATURE_MODERN,
  DEMO_SIGNATURE_BRANDED,
  DEMO_SIGNATURE_MINIMAL,

  // Workflow demos
  DEMO_WORKFLOW_AUTO_REPLY,
  DEMO_WORKFLOW_FOLLOWUP,
  DEMO_WORKFLOW_LABELING,

  // Warmup demos
  DEMO_WARMUP_BASICS,
  DEMO_WARMUP_PROGRESS,

  // Template demos (new)
  DEMO_TEMPLATE_NEWSLETTER,
  DEMO_TEMPLATE_INVOICE,
];

export function getDemoById(id: string): TemplateDemo | undefined {
  return ALL_DEMOS.find((d) => d.id === id);
}

export function getDemosForTemplate(templateId: string): TemplateDemo[] {
  return ALL_DEMOS.filter((d) => d.templateIds.includes(templateId));
}

/**
 * Extract the category from a demo ID.
 * Pattern: "demo-{category}-{name}" => category
 * Legacy demos (e.g. "demo-followup") default to "template".
 */
function inferDemoCategory(demo: TemplateDemo): string {
  const parts = demo.id.split("-");
  if (parts.length < 2) return "template";
  // parts[0] = "demo", parts[1] = category
  const category: string = parts[1] ?? "";
  const knownCategories = new Set(["signature", "workflow", "warmup", "template"]);
  return knownCategories.has(category) ? category : "template";
}

/**
 * Returns all demos that belong to a given category.
 * Categories: "template", "signature", "workflow", "warmup".
 */
export function getDemosByCategory(category: string): TemplateDemo[] {
  return ALL_DEMOS.filter((d) => inferDemoCategory(d) === category);
}

/**
 * Returns the list of all demo categories that have at least one demo.
 */
export function getAllDemoCategories(): string[] {
  const categories = new Set(ALL_DEMOS.map(inferDemoCategory));
  return Array.from(categories).sort();
}

