import { describe, it, expect } from "vitest";
import { emailPresets } from "@features/mail/constants/emailPresets";
import { campaignPresets } from "@/constants/campaignPresets";
import { WORKFLOW_PRESETS } from "@/constants/workflowPresets";

describe("emailPresets", () => {
  it("has exactly 20 entries", () => {
    expect(emailPresets).toHaveLength(20);
  });

  it("all have unique IDs", () => {
    const ids = emailPresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have required fields", () => {
    for (const p of emailPresets) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.subject).toBeTruthy();
      expect(p.bodyHtml).toBeTruthy();
    }
  });

  it("each preset contains at least one template variable", () => {
    for (const p of emailPresets) {
      const hasVariable = p.bodyHtml.includes("{{") && p.bodyHtml.includes("}}");
      expect(hasVariable, `${p.id} is missing template variables`).toBe(true);
    }
  });

  it("all categories are valid", () => {
    const valid = ["follow_up", "customer_success", "sales", "internal", "personal"] as const;
    for (const p of emailPresets) {
      expect(valid).toContain(p.category);
    }
  });
});

describe("campaignPresets", () => {
  it("has exactly 20 entries", () => {
    expect(campaignPresets).toHaveLength(20);
  });

  it("all have unique IDs", () => {
    const ids = campaignPresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have required fields", () => {
    for (const p of campaignPresets) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.subject).toBeTruthy();
      expect(p.bodyHtml).toBeTruthy();
    }
  });

  it("all categories are valid", () => {
    const valid = ["marketing", "sales", "customer_success", "transactional"] as const;
    for (const p of campaignPresets) {
      expect(valid).toContain(p.category);
    }
  });
});

describe("workflowPresets", () => {
  it("has exactly 20 entries", () => {
    expect(WORKFLOW_PRESETS).toHaveLength(20);
  });

  it("all have unique IDs", () => {
    const ids = WORKFLOW_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have required fields", () => {
    for (const p of WORKFLOW_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.trigger_event).toBeTruthy();
      expect(p.actions).toBeTruthy();
    }
  });

  it("all categories are valid", () => {
    const valid = ["automation", "ai_enhanced"] as const;
    for (const p of WORKFLOW_PRESETS) {
      expect(valid).toContain(p.category);
    }
  });

  it("has 10 automation and 10 ai_enhanced", () => {
    const automation = WORKFLOW_PRESETS.filter((p) => p.category === "automation");
    const aiEnhanced = WORKFLOW_PRESETS.filter((p) => p.category === "ai_enhanced");
    expect(automation).toHaveLength(10);
    expect(aiEnhanced).toHaveLength(10);
  });
});

describe("preset IDs across all arrays", () => {
  it("are unique across email, campaign, and workflow presets", () => {
    const allIds = [
      ...emailPresets.map((p) => p.id),
      ...campaignPresets.map((p) => p.id),
      ...WORKFLOW_PRESETS.map((p) => p.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("warmupPresets", () => {
  it("has exactly 24 entries", async () => {
    const { warmupPresets } = await import("@/constants/warmupPresets");
    expect(warmupPresets).toHaveLength(24);
  });

  it("all have unique IDs", async () => {
    const { warmupPresets } = await import("@/constants/warmupPresets");
    const ids = warmupPresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
