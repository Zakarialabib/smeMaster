import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Globe, Shield } from "lucide-react";
import { SettingsTabShell } from "./SettingsTabShell";

describe("SettingsTabShell", () => {
  it("renders the title and description", () => {
    render(
      <SettingsTabShell icon={Globe} title="DNS Checker" description="Validate DNS records">
        <div data-testid="body" />
      </SettingsTabShell>,
    );
    expect(screen.getByText("DNS Checker")).toBeInTheDocument();
    expect(screen.getByText("Validate DNS records")).toBeInTheDocument();
  });

  it("renders the children body", () => {
    render(
      <SettingsTabShell icon={Globe} title="X" description="Y">
        <div data-testid="body" />
      </SettingsTabShell>,
    );
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });

  it("renders the header actions when provided", () => {
    render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        headerActions={<button>Bulk Check</button>}
      >
        <div />
      </SettingsTabShell>,
    );
    expect(screen.getByRole("button", { name: "Bulk Check" })).toBeInTheDocument();
  });

  it("does not render the actions container when headerActions is omitted", () => {
    const { container } = render(
      <SettingsTabShell icon={Globe} title="X" description="Y">
        <div data-testid="body" />
      </SettingsTabShell>,
    );
    // The header div has the title block; only one flex row of header buttons
    // would exist. The right-side actions <div> should be absent.
    const header = container.querySelector(".sm\\:flex-row");
    expect(header).not.toBeNull();
    expect(header?.children.length).toBe(1); // only the title block
  });

  it("renders the stats grid when stats are provided", () => {
    render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        stats={[
          { label: "Domains", value: "—", icon: <Globe />, tone: "accent" },
          { label: "Authenticated", value: "—", icon: <Shield />, tone: "success" },
        ]}
      >
        <div />
      </SettingsTabShell>,
    );
    expect(screen.getByText("Domains")).toBeInTheDocument();
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
  });

  it("does not render the stats grid when stats is undefined", () => {
    const { container } = render(
      <SettingsTabShell icon={Globe} title="X" description="Y">
        <div data-testid="body" />
      </SettingsTabShell>,
    );
    // The grid class only appears when stats exist
    const grids = container.querySelectorAll(".grid-cols-2");
    expect(grids.length).toBe(0);
  });

  it("does not render the stats grid when stats is an empty array", () => {
    const { container } = render(
      <SettingsTabShell icon={Globe} title="X" description="Y" stats={[]}>
        <div data-testid="body" />
      </SettingsTabShell>,
    );
    expect(container.querySelectorAll(".grid-cols-2").length).toBe(0);
  });

  it("renders the help card toggle in collapsed mode by default", () => {
    render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        help={[{ label: "Why", body: "Because…" }]}
      >
        <div />
      </SettingsTabShell>,
    );
    expect(screen.getByText("Learn more")).toBeInTheDocument();
    // The body text is not visible until expanded
    expect(screen.queryByText("Because…")).not.toBeInTheDocument();
  });

  it("expands the help card when the toggle is clicked", () => {
    render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        help={[
          { label: "Why", body: "Because…" },
          { label: "How", body: "Do this…" },
        ]}
      >
        <div />
      </SettingsTabShell>,
    );
    fireEvent.click(screen.getByText("Learn more"));
    expect(screen.getByText("Why")).toBeInTheDocument();
    expect(screen.getByText("Because…")).toBeInTheDocument();
    expect(screen.getByText("How")).toBeInTheDocument();
    expect(screen.getByText("Do this…")).toBeInTheDocument();
  });

  it("collapses the help card when the close button is clicked", () => {
    render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        help={[{ label: "Why", body: "Because…" }]}
        helpDefaultOpen
      >
        <div />
      </SettingsTabShell>,
    );
    // Initially open
    expect(screen.getByText("Because…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse help" }));
    expect(screen.queryByText("Because…")).not.toBeInTheDocument();
  });

  it("starts with the help card open when helpDefaultOpen is true", () => {
    render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        help={[{ label: "Why", body: "Because…" }]}
        helpDefaultOpen
      >
        <div />
      </SettingsTabShell>,
    );
    expect(screen.getByText("Because…")).toBeInTheDocument();
  });

  it("does not render the help card when help is undefined or empty", () => {
    const { container: c1 } = render(
      <SettingsTabShell icon={Globe} title="X" description="Y">
        <div />
      </SettingsTabShell>,
    );
    expect(c1.querySelectorAll(".bg-accent\\/5").length).toBe(0);

    const { container: c2 } = render(
      <SettingsTabShell icon={Globe} title="X" description="Y" help={[]}>
        <div />
      </SettingsTabShell>,
    );
    expect(c2.querySelectorAll(".bg-accent\\/5").length).toBe(0);
  });

  it("applies a custom className to the outer container", () => {
    const { container } = render(
      <SettingsTabShell
        icon={Globe}
        title="X"
        description="Y"
        className="max-w-5xl"
      >
        <div />
      </SettingsTabShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("max-w-5xl");
  });

  it("renders the icon passed in the hero", () => {
    const { container } = render(
      <SettingsTabShell icon={Shield} title="X" description="Y">
        <div />
      </SettingsTabShell>,
    );
    // The hero icon is an <svg> with the lucide-shield class
    expect(container.querySelector("svg.lucide-shield")).not.toBeNull();
  });
});
