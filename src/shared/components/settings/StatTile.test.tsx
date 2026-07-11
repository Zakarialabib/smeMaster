import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shield } from "lucide-react";
import { StatTile } from "./StatTile";

describe("StatTile", () => {
  it("renders the label and value", () => {
    render(<StatTile label="Domains Monitored" value={42} />);
    expect(screen.getByText("Domains Monitored")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string values verbatim", () => {
    render(<StatTile label="Status" value="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(
      <StatTile
        label="Reputation Score"
        value="—"
        sub="Updated daily"
      />,
    );
    expect(screen.getByText("Updated daily")).toBeInTheDocument();
  });

  it("does not render the subtitle line when sub is omitted", () => {
    const { container } = render(<StatTile label="X" value="1" />);
    // Only the value paragraph and the label paragraph should be in the inner div
    const innerDiv = container.querySelector(".min-w-0");
    expect(innerDiv?.children.length).toBe(2);
  });

  it("renders '—' instead of the value when loading is true", () => {
    render(<StatTile label="Score" value="98" loading />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("98")).not.toBeInTheDocument();
  });

  it("renders the icon when provided", () => {
    const { container } = render(
      <StatTile
        label="Security"
        value="OK"
        icon={<Shield data-testid="stat-icon" className="w-4 h-4" />}
      />,
    );
    expect(screen.getByTestId("stat-icon")).toBeInTheDocument();
    expect(container.querySelector(".bg-white\\/50")).not.toBeNull();
  });

  it("does not render the icon box when no icon is provided", () => {
    const { container } = render(<StatTile label="X" value="1" />);
    expect(container.querySelector(".bg-white\\/50")).toBeNull();
  });

  it.each([
    ["neutral", "text-text-secondary"],
    ["success", "text-success"],
    ["warning", "text-warning"],
    ["danger", "text-danger"],
    ["accent", "text-accent"],
  ] as const)("applies the %s tone class", (tone, expectedClass) => {
    const { container } = render(
      <StatTile label="L" value="V" tone={tone} />,
    );
    const tile = container.firstChild as HTMLElement;
    expect(tile.className).toContain(expectedClass);
  });

  it("falls back to the neutral tone when tone is omitted", () => {
    const { container } = render(<StatTile label="L" value="V" />);
    const tile = container.firstChild as HTMLElement;
    expect(tile.className).toContain("text-text-secondary");
  });

  it("merges a custom className into the container", () => {
    const { container } = render(
      <StatTile label="L" value="V" className="extra-class" />,
    );
    const tile = container.firstChild as HTMLElement;
    expect(tile.className).toContain("extra-class");
  });
});
