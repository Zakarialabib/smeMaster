// Pure function: EmailBlock[] -> email-safe HTML string (table layout, inline
// styles). This is the core serialization used by the live preview and by the
// save flow (campaignComposerStore -> body_html). Never import React here.

import type {
  EmailBlock,
  HeadingBlock,
  ParagraphBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  TypographyProps,
  Padding,
} from "../components/editor/types";

export const EMAIL_MAX_WIDTH = 600;

const FONT_STACKS: Record<string, string> = {
  "sans-serif": "Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  monospace: "'Courier New', Courier, monospace",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Allow simple line breaks from block content; escape first.
function escMultiline(s: string): string {
  return esc(s).replace(/\n/g, "<br />");
}

function pad(p: Padding): string {
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

function typoToStyle(t: TypographyProps): string {
  return [
    `font-size:${t.fontSize}px`,
    `font-weight:${t.fontWeight}`,
    `color:${t.color}`,
    `font-family:${FONT_STACKS[t.fontFamily] ?? FONT_STACKS["sans-serif"]}`,
    `text-align:${t.textAlign}`,
    `line-height:${t.lineHeight}`,
    `margin:0`,
    `padding:${pad(t.padding)}`,
  ].join(";");
}

function renderHeading(b: HeadingBlock): string {
  const tag = `h${b.level}`;
  return `<tr><td><${tag} style="${typoToStyle(b.typography)}">${escMultiline(
    b.content,
  )}</${tag}></td></tr>`;
}

function renderParagraph(b: ParagraphBlock): string {
  return `<tr><td><p style="${typoToStyle(b.typography)}">${escMultiline(
    b.content,
  )}</p></td></tr>`;
}

function renderImage(b: ImageBlock): string {
  const align =
    b.alignment === "center"
      ? "margin:0 auto"
      : b.alignment === "right"
        ? "margin-left:auto;margin-right:0"
        : "margin:0";
  const img = `<img src="${esc(b.src)}" alt="${esc(b.alt)}" width="${b.width}" border="0" style="display:block;border-radius:${b.borderRadius}px;max-width:100%;height:auto" />`;
  const inner = b.linkUrl
    ? `<a href="${esc(b.linkUrl)}" target="_blank" rel="noopener" style="text-decoration:none">${img}</a>`
    : img;
  return `<tr><td style="padding:${pad(b.padding)}"><div style="${align};max-width:${b.width}px">${inner}</div></td></tr>`;
}

function renderButton(b: ButtonBlock): string {
  const align =
    b.alignment === "center"
      ? "text-align:center"
      : b.alignment === "right"
        ? "text-align:right"
        : "text-align:left";
  const btnStyle = [
    `display:${b.fullWidth ? "block" : "inline-block"}`,
    `background-color:${b.backgroundColor}`,
    `color:${b.textColor}`,
    `font-size:${b.typography.fontSize}px`,
    `font-weight:${b.typography.fontWeight}`,
    `font-family:${FONT_STACKS[b.typography.fontFamily] ?? FONT_STACKS["sans-serif"]}`,
    `text-decoration:none`,
    `border-radius:${b.borderRadius}px`,
    `padding:${pad(b.padding)}`,
  ].join(";");
  return `<tr><td style="padding:${pad(b.padding)};${align}"><a href="${esc(
    b.url,
  )}" target="_blank" rel="noopener" style="${btnStyle}">${esc(b.text)}</a></td></tr>`;
}

function renderDivider(b: DividerBlock): string {
  return `<tr><td style="padding:${pad(b.padding)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:${b.width}%;height:${b.thickness}px;background-color:${b.color};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
}

function renderSpacer(b: SpacerBlock): string {
  return `<tr><td style="height:${b.height}px;font-size:0;line-height:0">&nbsp;</td></tr>`;
}

export function renderEmailHtml(blocks: EmailBlock[]): string {
  const rows = blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return renderHeading(b);
        case "paragraph":
          return renderParagraph(b);
        case "image":
          return renderImage(b);
        case "button":
          return renderButton(b);
        case "divider":
          return renderDivider(b);
        case "spacer":
          return renderSpacer(b);
        default:
          return "";
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr><td align="center" style="padding:16px;">
      <table role="presentation" width="${EMAIL_MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${EMAIL_MAX_WIDTH}px;max-width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        ${rows || '<tr><td style="padding:24px;text-align:center;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">No content yet</td></tr>'}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
