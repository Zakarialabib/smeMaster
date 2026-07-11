import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-id"),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
    // Let the real db-invoke implementations run, which use invoke()
    // from @tauri-apps/api/core (already mocked above)
  };
});

import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import {
  insertTemplate,
  updateTemplate,
  getTemplatesByType,
  seedCampaignTemplates,
} from "./templates";

const mockInvoke = vi.mocked(invoke);

describe("templates service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("insertTemplate", () => {
    it("inserts a template with all new fields", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const id = await insertTemplate({
        accountId: "acc-1",
        name: "Test Campaign",
        subject: "Hello {{first_name}}",
        bodyHtml: "<p>Hello</p>",
        shortcut: null,
        templateType: "campaign",
        origin: "user_created",
        deliveryConfigJson: JSON.stringify({ schedule: "immediate" }),
        aiConfigJson: JSON.stringify({ prompt: "Write a friendly email" }),
        voiceConfigJson: JSON.stringify({ pacing: "conversational" }),
        complianceProfileId: "cp-gdpr",
      });

      expect(id).toBe("mock-id");
      expect(uuidv4).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_template", {
        id: "mock-id",
        accountId: "acc-1",
        name: "Test Campaign",
        subject: "Hello {{first_name}}",
        bodyHtml: "<p>Hello</p>",
        shortcut: null,
        categoryId: null,
        conditionalBlocksJson: null,
        templateType: "campaign",
        origin: "user_created",
        deliveryConfigJson: JSON.stringify({ schedule: "immediate" }),
        aiConfigJson: JSON.stringify({ prompt: "Write a friendly email" }),
        voiceConfigJson: JSON.stringify({ pacing: "conversational" }),
        complianceProfileId: "cp-gdpr",
      });
    });
  });

  describe("updateTemplate", () => {
    it("updates template_type and origin", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateTemplate("tmpl-1", {
        templateType: "campaign",
        origin: "ai_generated",
        deliveryConfigJson: null,
      });

      expect(mockInvoke).toHaveBeenCalledWith("db_update_template", {
        id: "tmpl-1",
        fields: {
          set: {
            template_type: "campaign",
            origin: "ai_generated",
            delivery_config_json: null,
          },
          unset: [],
        },
      });
    });

    it("skips update when no fields changed", async () => {
      await updateTemplate("tmpl-1", {});
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("getTemplatesByType", () => {
    it("queries by template_type", async () => {
      const rows = [{ id: "t1", template_type: "campaign" }];
      mockInvoke.mockResolvedValue(rows);
      const result = await getTemplatesByType("acc-1", "campaign");
      expect(result).toEqual(rows);
      expect(mockInvoke).toHaveBeenCalledWith("db_get_templates_by_type", {
        companyId: "acc-1",
        templateType: "campaign",
      });
    });
  });

  describe("seedCampaignTemplates", () => {
    it("skips seeding when 10 or more campaign built_in templates exist", async () => {
      mockInvoke.mockResolvedValue([{ count: 10 }]);
      await seedCampaignTemplates();
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it("inserts all campaign presets when none exist", async () => {
      mockInvoke
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValue(undefined);

      await seedCampaignTemplates();

      const calls = mockInvoke.mock.calls.filter(
        ([cmd]) => cmd === "db_insert_template_ignore",
      );
      expect(calls.length).toBeGreaterThanOrEqual(10);
      for (const call of calls) {
        expect(call[0]).toBe("db_insert_template_ignore");
        expect(call[1].templateType).toBe("campaign");
        expect(call[1].origin).toBe("built_in");
      }
    });
  });
});

