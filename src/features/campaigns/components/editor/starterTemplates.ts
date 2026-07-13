// Starter block templates for the campaign editor gallery. Each returns a
// fresh array of EmailBlock via createBlock-like factories. Kept dependency-free
// so the builder can load them with one call to store.loadBlocks(...).

import type { EmailBlock } from "./types";
import { genId } from "./blockDefaults";

function heading(content: string, level: 1 | 2 | 3 = 2): EmailBlock {
  return {
    id: genId(),
    type: "heading",
    content,
    level,
    typography: { fontSize: level === 1 ? 28 : level === 2 ? 22 : 18, fontWeight: 700, color: "#111827", fontFamily: "sans-serif", textAlign: "left", lineHeight: 1.3, padding: { top: 16, bottom: 8, left: 0, right: 0 } },
  };
}

function paragraph(content: string): EmailBlock {
  return {
    id: genId(),
    type: "paragraph",
    content,
    typography: { fontSize: 15, fontWeight: 400, color: "#374151", fontFamily: "sans-serif", textAlign: "left", lineHeight: 1.6, padding: { top: 8, bottom: 8, left: 0, right: 0 } },
  };
}

function button(text: string, url: string): EmailBlock {
  return {
    id: genId(),
    type: "button",
    text,
    url,
    backgroundColor: "#4f46e5",
    textColor: "#ffffff",
    borderRadius: 8,
    padding: { top: 12, bottom: 12, left: 24, right: 24 },
    alignment: "center",
    fullWidth: false,
    typography: { fontSize: 15, fontWeight: 600, fontFamily: "sans-serif" },
  };
}

function spacer(height = 24): EmailBlock {
  return { id: genId(), type: "spacer", height };
}

function divider(): EmailBlock {
  return { id: genId(), type: "divider", color: "#e5e7eb", thickness: 1, width: 100, padding: { top: 16, bottom: 16, left: 0, right: 0 } };
}

export interface StarterTemplate {
  key: string;
  label: string; // i18n key under campaign.editor
  build: () => EmailBlock[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "welcome",
    label: "welcome",
    build: () =>
      [
        heading("Welcome to {{company}}", 1),
        paragraph("Hi {{first_name}}, we're thrilled to have you on board. Here's what you can do next to get the most out of your account."),
        spacer(8),
        button("Get Started", "https://example.com/welcome"),
        spacer(8),
        paragraph("Questions? Just reply to this email — we read every one.",  ),
      ] as EmailBlock[],
  },
  {
    key: "newsletter",
    label: "newsletter",
    build: () =>
      [
        heading("{{company}} Monthly Newsletter", 2),
        paragraph("The latest product updates, tips, and stories from our team — curated just for you."),
        divider(),
        heading("This Month's Highlights", 3),
        paragraph("• New feature launch\n• Customer spotlight\n• Upcoming events"),
        spacer(8),
        button("Read More", "https://example.com/news"),
        spacer(8),
        paragraph("You're receiving this because you subscribed to {{company}} updates.", ),
      ] as EmailBlock[],
  },
  {
    key: "promo",
    label: "promo",
    build: () =>
      [
        heading("25% Off — This Weekend Only", 1),
        paragraph("Treat yourself to our best deal of the season. Use code SAVE25 at checkout."),
        spacer(8),
        button("Shop the Sale", "https://example.com/sale"),
        spacer(8),
        paragraph("Offer ends Sunday at midnight. Don't miss out!", ),
      ] as EmailBlock[],
  },
];
