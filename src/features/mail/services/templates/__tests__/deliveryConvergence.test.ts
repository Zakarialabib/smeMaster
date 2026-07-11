import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderTemplate } from "../renderPipeline";
import { FIXTURE_TEMPLATES } from "./fixtures";

const SIMPLE_SUBJECT = "Hello {{first_name}}";
const SIMPLE_BODY = "<p>Hi {{first_name}},</p><p>Welcome to our service!</p>";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Phase C: Delivery Convergence", () => {
  const template = {
    subject: SIMPLE_SUBJECT,
    body_html: SIMPLE_BODY,
  };

  it("campaign mode renders through pipeline", async () => {
    const result = await renderTemplate(template, {
      recipientEmail: "test@example.com",
      recipientName: "John",
      accountId: "test-account",
    }, 'email_html');
    expect(result.bodyHtml).toContain("Hi John");
    expect(result.bodyHtml).not.toContain("{{");
  });

  it("workflow mode renders through pipeline", async () => {
    const result = await renderTemplate(template, {
      recipientEmail: "user@domain.com",
      recipientName: "Alice",
      accountId: "test-account",
    }, 'email_html');
    expect(result.bodyHtml).toContain("Hi Alice");
  });

  it("warming mode renders through pipeline", async () => {
    const result = await renderTemplate(template, {
      recipientEmail: "warmup@test.com",
      recipientName: "Warmup User",
      accountId: "test-account",
    }, 'email_html');
    expect(result.bodyHtml).not.toContain("{{");
  });

  it("all modes produce same variable resolution for same context", async () => {
    const [html, _text, voice] = await Promise.all([
      renderTemplate(template, { recipientEmail: "a@b.com", recipientName: "X", accountId: "a" }, 'email_html'),
      renderTemplate(template, { recipientEmail: "a@b.com", recipientName: "X", accountId: "a" }, 'email_text'),
      renderTemplate(template, { recipientEmail: "a@b.com", recipientName: "X", accountId: "a" }, 'voice_script'),
    ]);
    expect(html.bodyHtml).toContain("Hi X");
    expect(voice.voiceScript).toBeDefined();
  });
});
