import { describe, it, expect } from "vitest";
import {
  useCompanyStore,
  getActiveCompany,
  companyInitials,
} from "./companyStore";

describe("companyStore — store state", () => {
  it("starts with empty companies and no active company", () => {
    expect(useCompanyStore.getState().activeCompanyId).toBe("");
    expect(useCompanyStore.getState().companies).toEqual([]);
    expect(useCompanyStore.getState().isLoading).toBe(false);
    expect(useCompanyStore.getState().error).toBeNull();
  });

  it("setActiveCompany updates the active company id", () => {
    const store = useCompanyStore.getState();
    store.setActiveCompany("test-co-1");
    expect(useCompanyStore.getState().activeCompanyId).toBe("test-co-1");
    // reset
    useCompanyStore.getState().setActiveCompany("");
  });
});

describe("companyStore — getActiveCompany", () => {
  const companies = [
    { id: "co-1", name: "Alpha SARL", ice: "001", role: "Owner" },
    { id: "co-2", name: "Beta SARL", ice: "002", role: "Admin" },
  ] as Parameters<typeof getActiveCompany>[0];

  it("returns the matching company for a known id", () => {
    const c = getActiveCompany(companies, "co-2");
    expect(c?.name).toBe("Beta SARL");
    expect(c?.ice).toBe("002");
  });

  it("falls back to the first company when id is unknown", () => {
    const c = getActiveCompany(companies, "does-not-exist");
    expect(c?.id).toBe("co-1");
  });

  it("returns null when list is empty", () => {
    const c = getActiveCompany([], "co-1");
    expect(c).toBeNull();
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
