import { categorizeByRules, type CategorizationInput } from "./ruleEngine";

function input(overrides: Partial<CategorizationInput> = {}): CategorizationInput {
  return {
    labelIds: [],
    fromAddress: null,
    listUnsubscribe: null,
    ...overrides,
  };
}

describe("categorizeByRules", () => {
  describe("Layer 1: Gmail CATEGORY_* labels", () => {
    it("maps CATEGORY_PROMOTIONS to Promotions", () => {
      expect(categorizeByRules(input({ labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] }))).toBe("Promotions");
    });

    it("maps CATEGORY_SOCIAL to Social", () => {
      expect(categorizeByRules(input({ labelIds: ["INBOX", "CATEGORY_SOCIAL"] }))).toBe("Social");
    });

    it("maps CATEGORY_UPDATES to Updates", () => {
      expect(categorizeByRules(input({ labelIds: ["INBOX", "CATEGORY_UPDATES"] }))).toBe("Updates");
    });

    it("maps CATEGORY_FORUMS to Primary", () => {
      expect(categorizeByRules(input({ labelIds: ["INBOX", "CATEGORY_FORUMS"] }))).toBe("Primary");
    });

    it("maps CATEGORY_PERSONAL to Primary", () => {
      expect(categorizeByRules(input({ labelIds: ["INBOX", "CATEGORY_PERSONAL"] }))).toBe("Primary");
    });

    it("Gmail labels take priority over domain heuristics", () => {
      expect(categorizeByRules(input({
        labelIds: ["CATEGORY_UPDATES"],
        fromAddress: "marketing@substack.com",
      }))).toBe("Updates");
    });
  });

  describe("Layer 2: Domain heuristics", () => {
    it("classifies social network domains as Social", () => {
      expect(categorizeByRules(input({ fromAddress: "notifications@facebookmail.com" }))).toBe("Social");
      expect(categorizeByRules(input({ fromAddress: "info@linkedin.com" }))).toBe("Social");
      expect(categorizeByRules(input({ fromAddress: "notify@twitter.com" }))).toBe("Social");
    });

    it("classifies newsletter platform domains as Newsletters", () => {
      expect(categorizeByRules(input({ fromAddress: "author@substack.com" }))).toBe("Newsletters");
      expect(categorizeByRules(input({ fromAddress: "campaign@mailchimp.com" }))).toBe("Newsletters");
      expect(categorizeByRules(input({ fromAddress: "sender@beehiiv.com" }))).toBe("Newsletters");
    });

    it("classifies promotional prefixes as Promotions", () => {
      expect(categorizeByRules(input({ fromAddress: "marketing@example.com" }))).toBe("Promotions");
      expect(categorizeByRules(input({ fromAddress: "promo@shop.com" }))).toBe("Promotions");
      expect(categorizeByRules(input({ fromAddress: "deals@store.com" }))).toBe("Promotions");
    });

    it("classifies update prefixes as Updates", () => {
      expect(categorizeByRules(input({ fromAddress: "noreply@github.com" }))).toBe("Updates");
      expect(categorizeByRules(input({ fromAddress: "notifications@bank.com" }))).toBe("Updates");
      expect(categorizeByRules(input({ fromAddress: "no-reply@service.com" }))).toBe("Updates");
      expect(categorizeByRules(input({ fromAddress: "security@company.com" }))).toBe("Updates");
    });

    it("social domain takes priority over update prefix", () => {
      // "notifications@facebookmail.com" - domain wins over prefix
      expect(categorizeByRules(input({ fromAddress: "notifications@facebookmail.com" }))).toBe("Social");
    });
  });

  describe("Layer 3: List-Unsubscribe header", () => {
    it("classifies list-unsubscribe mail as Promotions by default", () => {
      expect(categorizeByRules(input({
        fromAddress: "someone@randomcompany.com",
        listUnsubscribe: "<mailto:unsub@example.com>",
      }))).toBe("Promotions");
    });

    it("classifies list-unsubscribe from newsletter domains as Newsletters", () => {
      expect(categorizeByRules(input({
        fromAddress: "author@substack.com",
        listUnsubscribe: "<https://substack.com/unsub>",
      }))).toBe("Newsletters");
    });

    it("list-unsubscribe with no from address defaults to Promotions", () => {
      expect(categorizeByRules(input({
        listUnsubscribe: "<mailto:unsub@example.com>",
      }))).toBe("Promotions");
    });
  });

  describe("Layer 4: Default", () => {
    it("returns Primary for regular person-to-person email", () => {
      expect(categorizeByRules(input({ fromAddress: "alice@gmail.com" }))).toBe("Primary");
    });

    it("returns Primary when no signals present", () => {
      expect(categorizeByRules(input())).toBe("Primary");
    });

    it("returns Primary for unknown domains with normal local part", () => {
      expect(categorizeByRules(input({ fromAddress: "john.doe@company.com" }))).toBe("Primary");
    });
  });

  describe("Priority ordering", () => {
    it("Gmail label > domain heuristic > list-unsubscribe > default", () => {
      // All signals present but Gmail label wins
      const result = categorizeByRules(input({
        labelIds: ["CATEGORY_SOCIAL"],
        fromAddress: "marketing@substack.com",
        listUnsubscribe: "<mailto:unsub@example.com>",
      }));
      expect(result).toBe("Social");
    });

    it("domain heuristic > list-unsubscribe", () => {
      // Social domain + unsubscribe header → domain wins
      const result = categorizeByRules(input({
        fromAddress: "user@linkedin.com",
        listUnsubscribe: "<mailto:unsub@linkedin.com>",
      }));
      expect(result).toBe("Social");
    });
  });
});
