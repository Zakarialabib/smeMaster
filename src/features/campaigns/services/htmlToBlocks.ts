// Reverse parser: email HTML (as produced by renderEmailHtml, or any simple
// email HTML) -> EmailBlock[]. Best-effort: maps the common element shapes the
// editor emits back into editable blocks. Unrecognized structures fall back to
// a paragraph block so content is never silently dropped.

import type { EmailBlock } from "../components/editor/types";
import { createBlock } from "../components/editor/blockDefaults";

function textContent(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function inlineStyle(el: Element, prop: string): string | null {
  const s = (el as HTMLElement).style;
  return s.getPropertyValue(prop) || null;
}

// Parse a simple inline font-size like "22px" -> number.
function px(n: string | null): number | null {
  if (!n) return null;
  const m = n.match(/([\d.]+)px/);
  return m ? Number(m[1]) : null;
}

export function htmlToBlocks(html: string): EmailBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Collect top-level content-bearing nodes inside the email body table.
  const candidates: Element[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let n: Node | null = walker.nextNode();
  while (n) {
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (["h1", "h2", "h3", "p", "img", "a", "hr", "table", "div"].includes(tag)) {
      candidates.push(el);
    }
    n = walker.nextNode();
  }

  if (candidates.length === 0) {
    // No recognizable structure: if there's text, keep it as a paragraph.
    const text = doc.body.textContent?.trim();
    return text ? [makeParagraph(text)] : [];
  }

  const blocks: EmailBlock[] = [];
  for (const el of candidates) {
    const tag = el.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const b = createBlock("heading") as Extract<EmailBlock, { type: "heading" }>;
      b.content = textContent(el);
      b.level = (tag === "h1" ? 1 : tag === "h3" ? 3 : 2) as 1 | 2 | 3;
      const fs = px(inlineStyle(el, "font-size")) ?? (b.level === 1 ? 26 : b.level === 2 ? 22 : 18);
      b.typography = { ...b.typography, fontSize: fs };
      blocks.push(b);
    } else if (tag === "p") {
      const b = createBlock("paragraph") as Extract<EmailBlock, { type: "paragraph" }>;
      b.content = textContent(el);
      blocks.push(b);
    } else if (tag === "img") {
      const b = createBlock("image") as Extract<EmailBlock, { type: "image" }>;
      b.src = el.getAttribute("src") ?? "";
      b.alt = el.getAttribute("alt") ?? "";
      const w = px(el.getAttribute("width"));
      if (w) b.width = w;
      blocks.push(b);
    } else if (tag === "a" && (el.textContent ?? "").trim().length > 0 && !el.querySelector("img")) {
      const b = createBlock("button") as Extract<EmailBlock, { type: "button" }>;
      b.text = textContent(el);
      b.url = el.getAttribute("href") ?? "https://example.com";
      blocks.push(b);
    } else if (tag === "hr") {
      blocks.push(createBlock("divider"));
    } else if (tag === "table") {
      // Likely a card or columns block; try a card (single image+title+body+button).
      const card = parseCard(el);
      if (card) blocks.push(card);
      else blocks.push(makeParagraph(textContent(el)));
    } else {
      const text = textContent(el);
      if (text) blocks.push(makeParagraph(text));
    }
  }
  return blocks;
}

function makeParagraph(text: string): EmailBlock {
  const b = createBlock("paragraph") as Extract<EmailBlock, { type: "paragraph" }>;
  b.content = text;
  return b;
}

// Heuristic: detect a card block from a table containing an <img>, a title <h3>,
// a body <p>, and a button <a>. Returns null if it doesn't look like a card.
function parseCard(table: Element): EmailBlock | null {
  const img = table.querySelector("img");
  const title = table.querySelector("h3");
  const body = table.querySelector("p");
  const btn = Array.from(table.querySelectorAll("a")).find((a) => (a.textContent ?? "").trim().length > 0);
  if (!title && !img) return null;
  const b = createBlock("card") as Extract<EmailBlock, { type: "card" }>;
  if (img) {
    b.image = img.getAttribute("src") ?? "";
    b.imageAlt = img.getAttribute("alt") ?? "";
  }
  if (title) b.title = textContent(title);
  if (body) b.body = textContent(body);
  if (btn) {
    b.buttonText = textContent(btn);
    b.buttonUrl = btn.getAttribute("href") ?? "https://example.com";
  }
  return b;
}
