// Default block factories for the campaign editor palette. Each returns a
// complete, render-ready block. IDs are generated via crypto.randomUUID with a
// fallback (kept dependency-free).

import type { EmailBlock, BlockType, TypographyProps, Padding } from "./types";

export function genId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function basePad(): Padding {
  return { top: 8, bottom: 8, left: 16, right: 16 };
}

function bodyTypography(over: Partial<TypographyProps> = {}): TypographyProps {
  return {
    fontSize: 15,
    fontWeight: 400,
    color: "#1f2937",
    fontFamily: "sans-serif",
    textAlign: "left",
    lineHeight: 1.5,
    padding: basePad(),
    ...over,
  };
}

export function createBlock(type: BlockType): EmailBlock {
  const id = genId();
  switch (type) {
    case "heading":
      return {
        id,
        type: "heading",
        content: "Heading",
        level: 2,
        typography: bodyTypography({ fontSize: 22, fontWeight: 700, padding: { top: 12, bottom: 4, left: 16, right: 16 } }),
      };
    case "paragraph":
      return {
        id,
        type: "paragraph",
        content: "Write your message here. Keep it clear and concise.",
        typography: bodyTypography(),
      };
    case "image":
      return {
        id,
        type: "image",
        src: "",
        alt: "Image description",
        width: 520,
        alignment: "center",
        linkUrl: "",
        borderRadius: 8,
        padding: basePad(),
      };
    case "button":
      return {
        id,
        type: "button",
        text: "Call to action",
        url: "https://example.com",
        backgroundColor: "#0b57d0",
        textColor: "#ffffff",
        borderRadius: 8,
        padding: { top: 10, bottom: 10, left: 20, right: 20 },
        alignment: "center",
        fullWidth: false,
        typography: { fontSize: 15, fontWeight: 600, fontFamily: "sans-serif" },
      };
    case "divider":
      return {
        id,
        type: "divider",
        color: "#e5e7eb",
        thickness: 1,
        width: 100,
        padding: basePad(),
      };
    case "spacer":
      return { id, type: "spacer", height: 24 };
    case "card":
      return {
        id,
        type: "card",
        image: "",
        imageAlt: "",
        title: "Special offer",
        body: "Add a short, punchy description of what makes this offer worth clicking.",
        buttonText: "Learn more",
        buttonUrl: "https://example.com",
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: { top: 16, bottom: 16, left: 16, right: 16 },
        alignment: "left",
      };
    case "columns":
      return {
        id,
        type: "columns",
        leftHtml: "<h3 style=\"margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;\">Left</h3><p style=\"margin:0;font-family:Arial,Helvetica,sans-serif;\">Left column content.</p>",
        rightHtml: "<h3 style=\"margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;\">Right</h3><p style=\"margin:0;font-family:Arial,Helvetica,sans-serif;\">Right column content.</p>",
        backgroundColor: "#f9fafb",
        borderRadius: 12,
        padding: { top: 16, bottom: 16, left: 16, right: 16 },
        gap: 16,
      };
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}

export const BLOCK_PALETTE: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "card", label: "Card" },
  { type: "columns", label: "Columns" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
];
