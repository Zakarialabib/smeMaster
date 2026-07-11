import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/db/db-invoke")>();
  return {
    ...actual,
  };
});

import { invoke } from "@tauri-apps/api/core";
import {
  getActiveProfiles,
  getProfilesForDomains,
  getAllProfiles,
  upsertProfile,
  setProfileActive,
  setDefaultProfile,
  insertCheck,
} from "./complianceProfiles";

const mockInvoke = vi.mocked(invoke);

const mockDbProfile = {
  id: "cp-1",
  code: "GDPR",
  name: "GDPR Profile",
  description: "EU data protection",
  region_hint: ".eu,.de",
  rules_json: JSON.stringify([{ rule: "no_pii" }]),
  is_active: 1,
  is_default: 1,
};

describe("complianceProfiles service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllProfiles", () => {
    it("returns all profiles mapped to ComplianceProfile", async () => {
      mockInvoke.mockResolvedValue([mockDbProfile]);
      const result = await getAllProfiles();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "cp-1",
        code: "GDPR",
        name: "GDPR Profile",
        description: "EU data protection",
        regionHint: ".eu,.de",
        rules: [{ rule: "no_pii" }],
        isActive: true,
        isDefault: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_list_compliance_profiles", {});
    });

    it("handles invalid rules_json gracefully", async () => {
      mockInvoke.mockResolvedValue([
        { ...mockDbProfile, rules_json: "not-json" },
      ]);
      const result = await getAllProfiles();
      expect(result[0].rules).toEqual([]);
    });
  });

  describe("getActiveProfiles", () => {
    it("filters to only active profiles", async () => {
      mockInvoke.mockResolvedValue([
        mockDbProfile,
        { ...mockDbProfile, id: "cp-2", is_active: 0 },
      ]);
      const result = await getActiveProfiles();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("cp-1");
    });
  });

  describe("getProfilesForDomains", () => {
    it("returns empty for empty domains", async () => {
      const result = await getProfilesForDomains([]);
      expect(result).toEqual([]);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("filters profiles by matching region_hint", async () => {
      mockInvoke.mockResolvedValue([mockDbProfile]);
      const result = await getProfilesForDomains(["user@example.eu"]);
      expect(result).toHaveLength(1);
    });

    it("returns active profiles without region_hint for any domain", async () => {
      const noHintProfile = { ...mockDbProfile, id: "cp-2", region_hint: null };
      mockInvoke.mockResolvedValue([noHintProfile]);
      const result = await getProfilesForDomains(["any-domain.com"]);
      expect(result).toHaveLength(1);
    });

    it("excludes inactive profiles even if region matches", async () => {
      mockInvoke.mockResolvedValue([
        { ...mockDbProfile, is_active: 0 },
      ]);
      const result = await getProfilesForDomains(["user@example.eu"]);
      expect(result).toHaveLength(0);
    });

    it("excludes profiles when domain does not match region_hint", async () => {
      mockInvoke.mockResolvedValue([mockDbProfile]);
      const result = await getProfilesForDomains(["user@example.us"]);
      expect(result).toHaveLength(0);
    });
  });

  describe("upsertProfile", () => {
    it("calls db_upsert_compliance_profile with serialized rules", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await upsertProfile({
        id: "cp-1",
        code: "GDPR",
        name: "GDPR Profile",
        description: "EU data protection",
        regionHint: ".eu",
        rules: [{ rule: "no_pii" }],
        isActive: true,
        isDefault: false,
      });
      expect(mockInvoke).toHaveBeenCalledWith("db_upsert_compliance_profile", {
        profile: {
          id: "cp-1",
          code: "GDPR",
          name: "GDPR Profile",
          description: "EU data protection",
          regionHint: ".eu",
          rulesJson: JSON.stringify([{ rule: "no_pii" }]),
          isActive: true,
          isDefault: false,
        },
      });
    });
  });

  describe("setProfileActive", () => {
    it("calls db_set_compliance_profile_active", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await setProfileActive("cp-1", true);
      expect(mockInvoke).toHaveBeenCalledWith("db_set_compliance_profile_active", {
        id: "cp-1",
        active: true,
      });
    });

    it("can deactivate a profile", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await setProfileActive("cp-1", false);
      expect(mockInvoke).toHaveBeenCalledWith("db_set_compliance_profile_active", {
        id: "cp-1",
        active: false,
      });
    });
  });

  describe("setDefaultProfile", () => {
    it("calls db_set_default_compliance_profile", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await setDefaultProfile("cp-1");
      expect(mockInvoke).toHaveBeenCalledWith("db_set_default_compliance_profile", {
        id: "cp-1",
      });
    });
  });

  describe("insertCheck", () => {
    it("calls db_insert_compliance_check with generated id", async () => {
      const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      mockInvoke.mockResolvedValue(undefined);
      await insertCheck(
        "acc-1",
        "draft-1",
        null,
        "cp-1",
        0.95,
        JSON.stringify([]),
      );
      expect(mockInvoke).toHaveBeenCalledWith("db_insert_compliance_check", {
        check: {
          id: "acc-1_1700000000000",
          accountId: "acc-1",
          emailDraftId: "draft-1",
          campaignId: null,
          profileIds: "cp-1",
          score: 0.95,
          violationsJson: JSON.stringify([]),
        },
      });
      dateNowSpy.mockRestore();
    });
  });
});
