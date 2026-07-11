import { describe, it, expect } from "vitest";
import {
  useCompanyStore,
  getActiveCompany,
  companyInitials,
  MOCK_COMPANIES,
} from "./companyStore";

describe("companyStore — store state", () => {
  it("defaults activeCompanyId to the first mock company", () => {
    expect(useCompanyStore.getState().activeCompanyId).toBe(MOCK_COMPANIES[0]!.id);
  });

  it("seeds companies from MOCK_COMPANIES", () => {
    expect(useCompanyStore.getState().companies).toBe(MOCK_COMPANIES);
    expect(useCompanyStore.getState().companies).toHaveLength(3);
  });

  it("setActiveCompany updates the active company id", () => {
    useCompanyStore.getState().setActiveCompany("demo-company-2");
    expect(useCompanyStore.getState().activeCompanyId).toBe("demo-company-2");
    // restore default for other tests
    useCompanyStore.getState().setActiveCompany(MOCK_COMPANIES[0]!.id);
  });
});

describe("companyStore — getActiveCompany", () => {
  it("returns the matching company for a known id", () => {
    const c = getActiveCompany(MOCK_COMPANIES, "demo-company-3");
    expect(c.name).toBe("Medina Boutique");
    expect(c.ice).toBe("003456789000044");
  });

  it("falls back to the first company when id is unknown", () => {
    const c = getActiveCompany(MOCK_COMPANIES, "does-not-exist");
    expect(c.id).toBe(MOCK_COMPANIES[0]!.id);
  });

  it("falls back to the first company when the list is empty", () => {
    const c = getActiveCompany([], "demo-company-2");
    expect(c.id).toBe(MOCK_COMPANIES[0]!.id);
  });
});

describe("companyStore — companyInitials", () => {
  it("returns uppercase initials of the first two words", () => {
    expect(companyInitials("Atlas Trading SARL")).toBe("AT");
    expect(companyInitials("Sahara Logistics")).toBe("SL");
  });

  it("handles a single-word name", () => {
    expect(companyInitials("Medina")).toBe("M");
  });

  it("ignores extra whitespace", () => {
    expect(companyInitials("  Atlas   Trading ")).toBe("AT");
  });
});
