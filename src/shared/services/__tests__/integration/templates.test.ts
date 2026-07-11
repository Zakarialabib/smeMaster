import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { freshTestDb, runMigrations, getTestAccountId, seedAccount, createDbInvokeHandlers, MockTauriDb } from "./setup";

let db: MockTauriDb;
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@shared/utils/crypto", () => ({
  encryptValue: vi.fn((val: string) => Promise.resolve(`enc:${val}`)),
  decryptValue: vi.fn((val: string) => Promise.resolve(val.replace("enc:", ""))),
  isEncrypted: vi.fn((val: string) => val.startsWith("enc:")),
}));

describe("Integration: Templates", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    db = freshTestDb();
    await runMigrations();
    await seedAccount();

    const handlers = createDbInvokeHandlers(db);
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => handlers.handler(cmd, args));
  });

  afterEach(() => {
    db?.close();
  });

  describe("Template rendering with contact variables", () => {
    it("renders a template with interpolated contact variables", async () => {
      await db!.execute(
        "INSERT INTO contacts (id, email, display_name, notes) VALUES ($1, $2, $3, $4)",
        ["contact-1", "alice@example.com", "Alice Johnson", "Test contact"],
      );

      const { insertTemplate } = await import("@features/mail/db/templates");
      const templateId = await insertTemplate({
        accountId: getTestAccountId(),
        name: "Welcome Email",
        subject: "Hello {{first_name}}!",
        bodyHtml: "<p>Hi {{first_name}},</p><p>Welcome to {{company}}!</p><p>Best, {{my_name}}</p>",
        shortcut: "welcome",
      });

      const { getTemplateById } = await import("@features/mail/db/templates");
      const template = await getTemplateById(templateId);
      expect(template).not.toBeNull();

      const { renderTemplate } = await import("@features/mail/services/templates/renderPipeline");
      const result = await renderTemplate(
        { subject: template!.subject, body_html: template!.body_html, conditional_blocks_json: null },
        {
          accountId: getTestAccountId(),
          contactId: "contact-1",
          recipientName: "Alice Johnson",
          recipientEmail: "alice@example.com",
          senderName: "Bob Smith",
          myTitle: "CEO",
        },
      );

      expect(result.subject).toBe("Hello Alice!");
      expect(result.bodyHtml).toContain("Hi Alice");
      expect(result.bodyHtml).toContain("Welcome to example");
      expect(result.bodyHtml).toContain("Best, Bob Smith");
      expect(result.bodyText).toContain("Hi Alice");
    });

    it("renders template with synchronous variables (no contactId)", async () => {
      const { renderTemplate } = await import("@features/mail/services/templates/renderPipeline");

      const result = await renderTemplate(
        { subject: "Hello {{first_name}}", body_html: "<p>Hello {{first_name}}, your email is {{email}}</p>" },
        {
          accountId: getTestAccountId(),
          recipientName: "Charlie",
          recipientEmail: "charlie@example.com",
          subject: "Monthly Newsletter",
          senderName: "Newsletter Team",
        },
      );

      expect(result.subject).toBe("Hello Charlie");
      expect(result.bodyHtml).toContain("Hello Charlie");
      expect(result.bodyHtml).toContain("charlie@example.com");
    });

    it("renders template with conditional blocks", async () => {
      const { renderTemplate } = await import("@features/mail/services/templates/renderPipeline");

      const result = await renderTemplate(
        {
          subject: "Conditional Test",
          body_html: "<p>{{#if custom_greeting}}Special: {{custom_greeting}}{{else}}Default greeting{{/if}}</p>",
          conditional_blocks_json: JSON.stringify({ custom_greeting: "Happy Birthday!" }),
        },
        {
          accountId: getTestAccountId(),
          recipientName: "Diana",
          recipientEmail: "diana@example.com",
          conditionalVars: { custom_greeting: "Happy Birthday!" },
        },
      );

      expect(result.bodyHtml).toContain("Special:");
      expect(result.bodyHtml).not.toContain("Default greeting");
    });

    it("uses else branch when conditional variable is empty", async () => {
      const { renderTemplate } = await import("@features/mail/services/templates/renderPipeline");

      const result = await renderTemplate(
        {
          subject: "Conditional Else",
          body_html: "<p>{{#if promo_code}}Use code: {{promo_code}}{{else}}No promo available{{/if}}</p>",
          conditional_blocks_json: JSON.stringify({}),
        },
        {
          accountId: getTestAccountId(),
          recipientName: "Eve",
          recipientEmail: "eve@example.com",
        },
      );

      expect(result.bodyHtml).toContain("No promo available");
      expect(result.bodyHtml).not.toContain("Use code:");
    });
  });

  describe("Voice script conversion", () => {
    it("converts HTML template to voice script", async () => {
      const { renderTemplate } = await import("@features/mail/services/templates/renderPipeline");

      const result = await renderTemplate(
        { subject: "Voice Test", body_html: "<p>Hello {{first_name}},</p><p>Visit https://example.com for details</p>" },
        {
          accountId: getTestAccountId(),
          recipientName: "Frank",
          recipientEmail: "frank@example.com",
        },
        "voice_script",
      );

      expect(result.voiceScript).toBeDefined();
      expect(result.voiceScript).toContain("Hello Frank");
      expect(result.voiceScript).toContain("[link]");
    });
  });

  describe("Template storage and retrieval", () => {
    it("stores and retrieves a template from the database", async () => {
      const { insertTemplate, getTemplatesForAccount } = await import("@features/mail/db/templates");

      const id = await insertTemplate({
        accountId: getTestAccountId(),
        name: "Follow-up",
        subject: "Checking in",
        bodyHtml: "<p>Just checking in...</p>",
        shortcut: "fu",
        templateType: "email",
      });

      const templates = await getTemplatesForAccount(getTestAccountId());
      const saved = templates.find((t) => t.id === id);
      expect(saved).toBeDefined();
      expect(saved!.name).toBe("Follow-up");
      expect(saved!.subject).toBe("Checking in");
      expect(saved!.shortcut).toBe("fu");
      expect(saved!.template_type).toBe("email");
    });
  });
});
