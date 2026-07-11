import { normalizeEmail } from "./emailUtils";

describe("normalizeEmail", () => {
  it("lowercases an email address", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles both trim and lowercase", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeEmail("")).toBe("");
  });

  it("handles already normalized email", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("handles mixed-case local and domain parts", () => {
    expect(normalizeEmail("John.Doe@Gmail.Com")).toBe("john.doe@gmail.com");
  });
});
