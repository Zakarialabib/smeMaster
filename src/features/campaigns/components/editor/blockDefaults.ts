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
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}

export const BLOCK_PALETTE: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
];
