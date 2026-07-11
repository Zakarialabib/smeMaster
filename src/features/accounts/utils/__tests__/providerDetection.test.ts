import { describe, it, expect } from "vitest";
import { detectProvider, PROVIDER_MAP, PROVIDER_INFO } from "../providerDetection";

describe("detectProvider", () => {
  describe("Gmail detection", () => {
    it('detects gmail.com as gmail_api', () => {
      const result = detectProvider("user@gmail.com");
      expect(result.type).toBe("gmail_api");
      expect(result.letter).toBe("G");
      expect(result.label).toContain("Google");
    });

    it('detects googlemail.com as gmail_api', () => {
      const result = detectProvider("user@googlemail.com");
      expect(result.type).toBe("gmail_api");
      expect(result.letter).toBe("G");
    });
  });

  describe("Microsoft/Outlook detection", () => {
    it('detects outlook.com as microsoft_graph', () => {
      const result = detectProvider("user@outlook.com");
      expect(result.type).toBe("microsoft_graph");
      expect(result.letter).toBe("O");
    });

    it('detects hotmail.com as microsoft_graph', () => {
      const result = detectProvider("user@hotmail.com");
      expect(result.type).toBe("microsoft_graph");
      expect(result.letter).toBe("O");
    });

    it('detects live.com as microsoft_graph', () => {
      const result = detectProvider("user@live.com");
      expect(result.type).toBe("microsoft_graph");
      expect(result.letter).toBe("O");
    });

    it('detects outlook.fr as microsoft_graph', () => {
      const result = detectProvider("user@outlook.fr");
      expect(result.type).toBe("microsoft_graph");
      expect(result.letter).toBe("O");
    });

    it('detects outlook.de as microsoft_graph', () => {
      const result = detectProvider("user@outlook.de");
      expect(result.type).toBe("microsoft_graph");
      expect(result.letter).toBe("O");
    });
  });

  describe("JMAP detection", () => {
    it('detects yahoo.com as jmap', () => {
      const result = detectProvider("user@yahoo.com");
      expect(result.type).toBe("jmap");
      expect(result.letter).toBe("J");
    });

    it('detects ymail.com as jmap', () => {
      const result = detectProvider("user@ymail.com");
      expect(result.type).toBe("jmap");
      expect(result.letter).toBe("J");
    });
  });

  describe("IMAP detection", () => {
    it('detects aol.com as imap', () => {
      const result = detectProvider("user@aol.com");
      expect(result.type).toBe("imap");
      expect(result.letter).toBe("I");
    });

    it('returns imap for custom/unknown domains', () => {
      const result = detectProvider("user@custom-company.com");
      expect(result.type).toBe("imap");
      expect(result.letter).toBe("I");
    });

    it('returns imap for subdomains of unknown domains', () => {
      const result = detectProvider("user@mail.mycompany.org");
      expect(result.type).toBe("imap");
      expect(result.letter).toBe("I");
    });
  });

  describe("Edge cases", () => {
    it('returns imap for invalid email without @', () => {
      const result = detectProvider("not-an-email");
      expect(result.type).toBe("imap");
      expect(result.letter).toBe("I");
    });

    it('returns imap for empty string', () => {
      const result = detectProvider("");
      expect(result.type).toBe("imap");
    });

    it('returns imap for email with just @', () => {
      const result = detectProvider("user@");
      expect(result.type).toBe("imap");
    });

    it('handles mixed case domains', () => {
      const result = detectProvider("User@GMAIL.COM");
      expect(result.type).toBe("gmail_api");
      expect(result.letter).toBe("G");
    });

    it('handles emails with plus addressing', () => {
      const result = detectProvider("user+spam@gmail.com");
      expect(result.type).toBe("gmail_api");
      expect(result.letter).toBe("G");
    });

    it('handles subdomains of known domains', () => {
      const result = detectProvider("user@mail.outlook.com");
      expect(result.type).toBe("microsoft_graph");
      expect(result.letter).toBe("O");
    });

    it('handles subdomains of gmail', () => {
      const result = detectProvider("user@mail.gmail.com");
      expect(result.type).toBe("gmail_api");
      expect(result.letter).toBe("G");
    });
  });
});

describe("PROVIDER_MAP", () => {
  it("contains all expected domain entries", () => {
    expect(Object.keys(PROVIDER_MAP)).toContain("gmail.com");
    expect(Object.keys(PROVIDER_MAP)).toContain("outlook.com");
    expect(Object.keys(PROVIDER_MAP)).toContain("yahoo.com");
  });
});

describe("PROVIDER_INFO", () => {
  it("contains entries for all provider types", () => {
    expect(PROVIDER_INFO.gmail_api).toBeDefined();
    expect(PROVIDER_INFO.microsoft_graph).toBeDefined();
    expect(PROVIDER_INFO.jmap).toBeDefined();
    expect(PROVIDER_INFO.imap).toBeDefined();
  });

  it("has correct letter badges", () => {
    expect(PROVIDER_INFO.gmail_api.letter).toBe("G");
    expect(PROVIDER_INFO.microsoft_graph.letter).toBe("O");
    expect(PROVIDER_INFO.jmap.letter).toBe("J");
    expect(PROVIDER_INFO.imap.letter).toBe("I");
  });
});
