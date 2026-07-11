import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoPanelContent } from "./InfoPanelContent";

const knownEntry = {
  summary: "Smart Folders are saved searches",
  description: "Smart Folders work like saved search filters.",
  tips: [
    "Use quotes for exact phrase matching",
    "Combine with labels",
    "Smart Folders update in real-time",
  ],
  learnMoreHref: "/help/smart-folders",
};

const entryWithoutTips = {
  summary: "Split inbox separates mail",
  description: "Your inbox is divided into category tabs.",
};

vi.mock("@/constants/contextualHelp", () => ({
  getContextualHelp: vi.fn((key: string) => {
    if (key === "smart-folders") return knownEntry;
    if (key === "split-inbox") return entryWithoutTips;
    return undefined;
  }),
}));

describe("InfoPanelContent", () => {
  // ─── Renders description ─────────────────────────────────────────────

  it("renders description for valid infoKey", () => {
    render(<InfoPanelContent infoKey="smart-folders" />);
    expect(
      screen.getByText("Smart Folders work like saved search filters."),
    ).toBeInTheDocument();
  });

  // ─── Renders tips ────────────────────────────────────────────────────

  it("renders tips list when tips exist", () => {
    render(<InfoPanelContent infoKey="smart-folders" />);

    expect(screen.getByText("Tips")).toBeInTheDocument();
    expect(
      screen.getByText("Use quotes for exact phrase matching"),
    ).toBeInTheDocument();
    expect(screen.getByText("Combine with labels")).toBeInTheDocument();
    expect(
      screen.getByText("Smart Folders update in real-time"),
    ).toBeInTheDocument();
  });

  it("does not render Tips heading when there are no tips", () => {
    render(<InfoPanelContent infoKey="split-inbox" />);

    expect(screen.queryByText("Tips")).not.toBeInTheDocument();
  });

  // ─── Key count matches expected number of tips ───────────────────────

  it("renders correct number of tip list items", () => {
    render(<InfoPanelContent infoKey="smart-folders" />);

    // The tips are inside a <ul> as <li> elements
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    expect(list.children.length).toBe(3);
  });

  // ─── Fallback for invalid key ────────────────────────────────────────

  it('shows "Help content not found" for invalid key', () => {
    render(<InfoPanelContent infoKey="nonexistent-key" />);

    expect(
      screen.getByText("Help content not found."),
    ).toBeInTheDocument();
  });

  it("fallback message has italic styling", () => {
    render(<InfoPanelContent infoKey="nonexistent" />);

    const fallback = screen.getByText("Help content not found.");
    expect(fallback.className).toContain("italic");
    expect(fallback.className).toContain("text-text-tertiary");
  });

  // ─── Structure and elements ──────────────────────────────────────────

  it("uses bullet points for tips", () => {
    render(<InfoPanelContent infoKey="smart-folders" />);

    // Each tip has a bullet (•) element
    const bullets = screen.getAllByText("•");
    expect(bullets).toHaveLength(3);
  });

  it("renders nothing for description when key is invalid", () => {
    render(<InfoPanelContent infoKey="nonexistent" />);

    // Only the fallback message should exist, no description
    expect(screen.queryByText("Tips")).not.toBeInTheDocument();
  });
});
