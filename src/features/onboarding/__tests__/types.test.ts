import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS, DEFAULT_TOOLS } from "../types";

describe("Onboarding types — constants", () => {
  it("has exactly 4 onboarding steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(4);
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(ids).toEqual(["welcome", "tools", "account", "complete"]);
  });

  it("each step has id, title, description", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it("DEFAULT_TOOLS enables mail and crm, disables everything else", () => {
    expect(DEFAULT_TOOLS).toEqual({
      mail: true,
      crm: true,
      campaigns: false,
      calendar: false,
      ai: false,
      sync: false,
    });
  });

  it("all DEFAULT_TOOLS keys are booleans", () => {
    for (const val of Object.values(DEFAULT_TOOLS)) {
      expect(typeof val).toBe("boolean");
    }
  });
});
