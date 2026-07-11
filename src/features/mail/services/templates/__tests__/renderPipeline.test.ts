import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderTemplate, type RenderContext } from "../renderPipeline";
import { evaluateConditionalBlocks, resolveCampaignVariablesInPipeline } from "../campaignVariables";
import { FIXTURE_TEMPLATES } from "./fixtures";

const BASE_CONTEXT: RenderContext = {
  accountId: "acc-1",
  recipientEmail: "john@acme.com",
  recipientName: "John Doe",
  senderName: "Jane Smith",
  senderEmail: "jane@mycompany.com",
  subject: "Hello",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renderTemplate", () => {
  it("renders simple template", async () => {
    const result = await renderTemplate(FIXTURE_TEMPLATES.simple, BASE_CONTEXT);
    expect(result.bodyHtml).toMatchSnapshot("simple-body-html");
    expect(result.bodyText).toMatchSnapshot("simple-body-text");
    expect(result.subject).toMatchSnapshot("simple-subject");
  });

  it("renders with conditional true branch", async () => {
    const template = {
      subject: 'Update',
      body_html: '{{#if company}}<p>Hello {{company}}</p>{{else}}<p>Hello there</p>{{/if}}',
      conditional_blocks_json: JSON.stringify({ company: "AcmeCorp" }),
    };
    const result = await renderTemplate(template, BASE_CONTEXT);
    expect(result.bodyHtml).toMatchSnapshot("conditional-true");
  });

  it("renders with conditional false branch", async () => {
    const template = {
      subject: 'Update',
      body_html: '{{#if company}}<p>Hello {{company}}</p>{{else}}<p>Hello there</p>{{/if}}',
      conditional_blocks_json: JSON.stringify({ company: "" }),
    };
    const result = await renderTemplate(template, BASE_CONTEXT);
    expect(result.bodyHtml).toMatchSnapshot("conditional-false");
  });

  it("renders in voice mode", async () => {
    const result = await renderTemplate(FIXTURE_TEMPLATES.voiceMode, BASE_CONTEXT, "voice_script");
    expect(result.voiceScript).toMatchSnapshot("voice-script");
    expect(result.bodyHtml).toMatchSnapshot("voice-body-html");
  });

  it("renders campaign-style template", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = await renderTemplate(FIXTURE_TEMPLATES.campaignStyle, {
      ...BASE_CONTEXT,
      contactId: "contact-1",
    });
    expect(result.bodyHtml).toMatchSnapshot("campaign-style-body");
    expect(result.subject).toMatchSnapshot("campaign-style-subject");
  });

  it("renders with all variables empty (graceful degradation)", async () => {
    const emptyContext: RenderContext = {
      accountId: "acc-1",
    };
    const result = await renderTemplate(
      {
        subject: '{{first_name}}',
        body_html: '<p>Hi {{first_name}}, {{company}} {{email}}</p>',
      },
      emptyContext,
    );
    expect(result.bodyHtml).toMatchSnapshot("graceful-degradation");
    expect(result.subject).toMatchSnapshot("graceful-subject");
  });
});

describe("evaluateConditionalBlocks", () => {
  it("evaluates true branch when variable has value", () => {
    const result = evaluateConditionalBlocks(
      "{{#if company}}Hello {{company}}{{else}}Hello there{{/if}}",
      { company: "Acme" },
    );
    expect(result).toBe("Hello {{company}}");
  });

  it("evaluates false branch when variable is empty", () => {
    const result = evaluateConditionalBlocks(
      "{{#if company}}Hello {{company}}{{else}}Hello there{{/if}}",
      { company: "" },
    );
    expect(result).toBe("Hello there");
  });

  it("evaluates false branch when variable is missing", () => {
    const result = evaluateConditionalBlocks(
      "{{#if company}}Hello {{company}}{{else}}Hello there{{/if}}",
      {},
    );
    expect(result).toBe("Hello there");
  });

  it("handles nested content with line breaks", () => {
    const result = evaluateConditionalBlocks(
      "{{#if feature}}\n<p>Feature is enabled</p>\n{{else}}\n<p>No feature</p>\n{{/if}}",
      { feature: "on" },
    );
    expect(result).toBe("\n<p>Feature is enabled</p>\n");
  });
});

describe("resolveCampaignVariablesInPipeline", () => {
  it("returns html with variables resolved to empty when no contactId", async () => {
    const result = await resolveCampaignVariablesInPipeline(
      "<p>Hello {{first_name}}</p>",
      { accountId: "acc-1" },
    );
    expect(result).toBe("<p>Hello </p>");
  });

  it("returns html unchanged when no template variables present", async () => {
    const result = await resolveCampaignVariablesInPipeline(
      "<p>Hello</p>",
      { accountId: "acc-1", contactId: "contact-1" },
    );
    expect(result).toBe("<p>Hello</p>");
  });

  it("resolves known variables with fallback context values", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = await resolveCampaignVariablesInPipeline(
      "{{random_greeting}} {{first_name}} at {{company}}",
      {
        accountId: "acc-1",
        contactId: "contact-missing",
        recipientEmail: "john@acme.com",
        recipientName: "John Doe",
      },
    );
    expect(result).toMatchSnapshot("resolve-campaign-vars");
  });
});
