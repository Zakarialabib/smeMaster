// Block-based email content model for the Paperling-grade campaign editor.
// These types are the single contract between the editor UI, the dnd-kit list,
// the config panel, the live preview renderer, and the persistence layer
// (campaignComposerStore -> body_html). Do NOT change field names without
// updating emailRenderer.ts and the config panel.

export type BlockType =
  | "heading"
  | "paragraph"
  | "image"
  | "button"
  | "divider"
  | "spacer";

export type FontFamily = "sans-serif" | "serif" | "monospace";
export type TextAlign = "left" | "center" | "right";

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TypographyProps {
  fontSize: number; // px
  fontWeight: 400 | 500 | 600 | 700;
  color: string; // hex
  fontFamily: FontFamily;
  textAlign: TextAlign;
  lineHeight: number; // unitless
  padding: Padding; // px
}

export interface BlockBase {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  content: string;
  level: 1 | 2 | 3;
  typography: TypographyProps;
}

export interface ParagraphBlock extends BlockBase {
  type: "paragraph";
  content: string;
  typography: TypographyProps;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  /**
   * Either a vault path (resolved at render/send time via vaultService) or a
   * transient data URL (during authoring). Store the vault path when picked.
   */
  src: string;
  alt: string;
  width: number; // px
  alignment: TextAlign;
  linkUrl: string; // optional click-through URL
  borderRadius: number; // px
  padding: Padding;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number; // px
  padding: Padding;
  alignment: TextAlign;
  fullWidth: boolean;
  typography: Pick<TypographyProps, "fontSize" | "fontWeight" | "fontFamily">;
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  color: string;
  thickness: number; // px
  width: number; // percentage 0-100
  padding: Padding;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number; // px
}

export type EmailBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock;
