import { describe, it, expect } from "vitest";
import { DEMO_PRESETS } from "../steps/demoPresets";

describe("demoPresets", () => {
  it("exports exactly 4 presets", () => {
    expect(DEMO_PRESETS).toHaveLength(4);
  });

  it("includes all expected preset IDs", () => {
    const ids = DEMO_PRESETS.map((p) => p.id);
    expect(ids).toContain("solo_freelancer");
    expect(ids).toContain("small_team");
    expect(ids).toContain("sales_focused");
    expect(ids).toContain("custom");
  });

  it("solo_freelancer enables mail, crm, calendar but not campaigns, ai", () => {
    const preset = DEMO_PRESETS.find((p) => p.id === "solo_freelancer");
    expect(preset).toBeDefined();
    expect(preset!.tools).toEqual({
      mail: true,
      crm: true,
      campaigns: false,
      calendar: true,
      ai: false,
    });
  });

  it("small_team enables all tools", () => {
    const preset = DEMO_PRESETS.find((p) => p.id === "small_team");
    expect(preset).toBeDefined();
    expect(preset!.tools).toEqual({
      mail: true,
      crm: true,
      campaigns: true,
      calendar: true,
      ai: true,
    });
  });

  it("sales_focused enables mail, crm, campaigns, ai but not calendar", () => {
    const preset = DEMO_PRESETS.find((p) => p.id === "sales_focused");
    expect(preset).toBeDefined();
    expect(preset!.tools).toEqual({
      mail: true,
      crm: true,
      campaigns: true,
      calendar: false,
      ai: true,
    });
  });

  it("custom enables only mail and crm by default", () => {
    const preset = DEMO_PRESETS.find((p) => p.id === "custom");
    expect(preset).toBeDefined();
    expect(preset!.tools).toEqual({
      mail: true,
      crm: true,
      campaigns: false,
      calendar: false,
      ai: false,
    });
  });

  it("every preset has a label, description, icon, and tools", () => {
    for (const preset of DEMO_PRESETS) {
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.tools).toBeDefined();
      expect(typeof preset.tools.mail).toBe("boolean");
      expect(typeof preset.tools.crm).toBe("boolean");
      expect(typeof preset.tools.campaigns).toBe("boolean");
      expect(typeof preset.tools.calendar).toBe("boolean");
      expect(typeof preset.tools.ai).toBe("boolean");
    }
  });
});
