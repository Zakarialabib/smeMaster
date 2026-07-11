import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCsvContent, type CsvContact } from "./csvParser";

vi.mock("papaparse", () => ({
  default: {
    parse: vi.fn(),
  },
}));

import Papa from "papaparse";

function mockParseResult(rows: Record<string, string>[], errors: unknown[] = []) {
  vi.mocked(Papa.parse).mockReturnValue({
    data: rows,
    errors,
    meta: { fields: rows.length > 0 ? Object.keys(rows[0]!) : [] },
  } as unknown as Papa.ParseResult<Record<string, string>>);
}

describe("parseCsvContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty content", () => {
    mockParseResult([]);
    expect(parseCsvContent("")).toEqual([]);
  });

  it("returns empty array for header row only (no data)", () => {
    mockParseResult([]);
    // skipEmptyLines: true means this single empty row is skipped
    const result = parseCsvContent("email,name\n");
    expect(result).toEqual([]);
  });

  it("returns empty array when no email column exists", () => {
    mockParseResult([{ name: "John", phone: "123" }]);
    expect(parseCsvContent("name,phone\nJohn,123")).toEqual([]);
  });

  it("recognizes email alias 'e-mail'", () => {
    mockParseResult([{ "e-mail": "john@example.com", name: "John" }]);
    const result = parseCsvContent('e-mail,name\njohn@example.com,John');
    expect(result[0]?.email).toBe("john@example.com");
  });

  it("recognizes email alias 'mail'", () => {
    mockParseResult([{ mail: "alice@example.com" }]);
    const result = parseCsvContent("mail\nalice@example.com");
    expect(result[0]?.email).toBe("alice@example.com");
  });

  it("recognizes name alias 'full_name'", () => {
    mockParseResult([{ email: "john@example.com", full_name: "John Doe" }]);
    const result = parseCsvContent("email,full_name\njohn@example.com,John Doe");
    expect(result[0]?.display_name).toBe("John Doe");
  });

  it("combines first and last name into display_name", () => {
    mockParseResult([{ email: "john@example.com", first_name: "John", last_name: "Doe" }]);
    const result = parseCsvContent("email,first_name,last_name\njohn@example.com,John,Doe");
    expect(result[0]?.display_name).toBe("John Doe");
  });

  it("uses first name alone when last name is missing", () => {
    mockParseResult([{ email: "john@example.com", first_name: "John", last_name: "" }]);
    const result = parseCsvContent("email,first_name,last_name\njohn@example.com,John,");
    expect(result[0]?.display_name).toBe("John");
  });

  it("maps notes field correctly", () => {
    mockParseResult([{ email: "john@example.com", notes: "VIP customer" }]);
    const result = parseCsvContent("email,notes\njohn@example.com,VIP customer");
    expect(result[0]?.notes).toBe("VIP customer");
  });

  it("recognizes notes alias 'description'", () => {
    mockParseResult([{ email: "john@example.com", description: "Lead prospect" }]);
    const result = parseCsvContent("email,description\njohn@example.com,Lead prospect");
    expect(result[0]?.notes).toBe("Lead prospect");
  });

  it("deduplicates duplicate emails (first wins)", () => {
    mockParseResult([
      { email: "john@example.com", name: "John" },
      { email: "john@example.com", name: "Johnny" },
    ]);
    const result = parseCsvContent(
      "email,name\njohn@example.com,John\njohn@example.com,Johnny"
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.display_name).toBe("John");
  });

  it("trims whitespace on all fields", () => {
    mockParseResult([{ email: "  john@example.com  ", name: "  John  " }]);
    const result = parseCsvContent("email,name\n  john@example.com  ,  John  ");
    expect(result[0]?.email).toBe("john@example.com");
    expect(result[0]?.display_name).toBe("John");
  });

  it("normalizes email to lowercase", () => {
    mockParseResult([{ email: "JOHN@EXAMPLE.COM" }]);
    const result = parseCsvContent("email\nJOHN@EXAMPLE.COM");
    expect(result[0]?.email).toBe("john@example.com");
  });

  it("skips rows with empty email", () => {
    mockParseResult([{ email: "john@example.com" }, { email: "" }, { email: "jane@example.com" }]);
    const result = parseCsvContent(
      "email\njohn@example.com\n\njane@example.com"
    );
    expect(result).toHaveLength(2);
  });

  it("skips rows with whitespace-only email", () => {
    mockParseResult([{ email: "john@example.com" }, { email: "   " }, { email: "jane@example.com" }]);
    const result = parseCsvContent(
      "email\njohn@example.com\n   \njane@example.com"
    );
    expect(result).toHaveLength(2);
  });
});