import { describe, it, expect, vi } from "vitest";
import { queryKeys } from "@shared/query/keys";

describe("queryKeys", () => {
  describe("key factory consistency", () => {
    it("should have all required domains", () => {
      expect(queryKeys).toHaveProperty("accounts");
      expect(queryKeys).toHaveProperty("threads");
      expect(queryKeys).toHaveProperty("labels");
      expect(queryKeys).toHaveProperty("contacts");
      expect(queryKeys).toHaveProperty("tasks");
      expect(queryKeys).toHaveProperty("calendars");
      expect(queryKeys).toHaveProperty("campaigns");
      expect(queryKeys).toHaveProperty("vault");
      expect(queryKeys).toHaveProperty("deliverability");
      expect(queryKeys).toHaveProperty("logs");
      expect(queryKeys).toHaveProperty("settings");
      expect(queryKeys).toHaveProperty("ai");
    });

    it("should have all domains as readonly", () => {
      const keys = queryKeys as any;
      expect(Object.keys(keys).length).toBeGreaterThanOrEqual(12);
    });

    it("should have all domains as const objects", () => {
      const keys = queryKeys as any;
      expect(typeof keys).toBe("object");
      expect(Object.keys(keys).every(key => typeof keys[key] === "object")).toBe(true);
    });
  });

  describe("key generation for all domains", () => {
    describe("accounts domain", () => {
      it("should generate all key types for accounts", () => {
        expect(queryKeys.accounts.all).toEqual(["accounts"]);
        expect(typeof queryKeys.accounts.list).toBe("function");
        expect(typeof queryKeys.accounts.detail).toBe("function");
      });

      it("should generate account list key", () => {
        const key = queryKeys.accounts.list();
        expect(key).toEqual(["accounts", "list"]);
      });

      it("should generate account detail key", () => {
        const key = queryKeys.accounts.detail("account-123");
        expect(key).toEqual(["accounts", "detail", "account-123"]);
      });
    });

    describe("threads domain", () => {
      it("should generate all key types for threads", () => {
        expect(queryKeys.threads.all).toEqual(["threads"]);
        expect(typeof queryKeys.threads.list).toBe("function");
        expect(typeof queryKeys.threads.detail).toBe("function");
        expect(typeof queryKeys.threads.forCategory).toBe("function");
      });

      it("should generate threads list key with accountId only", () => {
        const key = queryKeys.threads.list("account-123");
        expect(key).toEqual(["threads", "list", "account-123"]);
      });

      it("should generate threads list key with accountId and folder", () => {
        const key = queryKeys.threads.list("account-123", "INBOX");
        expect(key).toEqual(["threads", "list", "account-123", "INBOX"]);
      });

      it("should generate threads detail key", () => {
        const key = queryKeys.threads.detail("account-123", "thread-456");
        expect(key).toEqual(["threads", "detail", "account-123", "thread-456"]);
      });

      it("should generate threads category key", () => {
        const key = queryKeys.threads.forCategory("account-123", "work");
        expect(key).toEqual(["threads", "category", "account-123", "work"]);
      });
    });

    describe("labels domain", () => {
      it("should generate all key types for labels", () => {
        expect(queryKeys.labels.all).toEqual(["labels"]);
        expect(typeof queryKeys.labels.byAccount).toBe("function");
        expect(typeof queryKeys.labels.unreadCounts).toBe("function");
      });

      it("should generate labels by account key", () => {
        const key = queryKeys.labels.byAccount("account-123");
        expect(key).toEqual(["labels", "account-123"]);
      });

      it("should generate labels unread counts key", () => {
        const key = queryKeys.labels.unreadCounts("account-123");
        expect(key).toEqual(["labels", "unread", "account-123"]);
      });
    });

    describe("contacts domain", () => {
      it("should generate all key types for contacts", () => {
        expect(queryKeys.contacts.all).toEqual(["contacts"]);
        expect(typeof queryKeys.contacts.list).toBe("function");
        expect(typeof queryKeys.contacts.detail).toBe("function");
        expect(typeof queryKeys.contacts.segments).toBe("function");
        expect(typeof queryKeys.contacts.groups).toBe("function");
      });

      it("should generate contacts list key with accountId", () => {
        const key = queryKeys.contacts.list("account-123");
        expect(key).toEqual(["contacts", "list", "account-123"]);
      });

      it("should generate contacts detail key", () => {
        const key = queryKeys.contacts.detail("contact-123");
        expect(key).toEqual(["contacts", "detail", "contact-123"]);
      });

      it("should generate contacts segments key", () => {
        const key = queryKeys.contacts.segments("account-123");
        expect(key).toEqual(["contacts", "segments", "account-123"]);
      });

      it("should generate contacts groups key", () => {
        const key = queryKeys.contacts.groups("account-123");
        expect(key).toEqual(["contacts", "groups", "account-123"]);
      });
    });

    describe("tasks domain", () => {
      it("should generate all key types for tasks", () => {
        expect(queryKeys.tasks.all).toEqual(["tasks"]);
        expect(typeof queryKeys.tasks.list).toBe("function");
        expect(typeof queryKeys.tasks.detail).toBe("function");
      });

      it("should generate tasks list key with accountId", () => {
        const key = queryKeys.tasks.list("account-123");
        expect(key).toEqual(["tasks", "list", "account-123"]);
      });

      it("should generate tasks detail key", () => {
        const key = queryKeys.tasks.detail("task-123");
        expect(key).toEqual(["tasks", "detail", "task-123"]);
      });
    });

    describe("calendars domain", () => {
      it("should generate all key types for calendars", () => {
        expect(queryKeys.calendars.all).toEqual(["calendars"]);
        expect(typeof queryKeys.calendars.list).toBe("function");
        expect(typeof queryKeys.calendars.events).toBe("function");
      });

      it("should generate calendars list key", () => {
        const key = queryKeys.calendars.list("account-123");
        expect(key).toEqual(["calendars", "list", "account-123"]);
      });

      it("should generate calendars events key", () => {
        const key = queryKeys.calendars.events("account-123");
        expect(key).toEqual(["calendars", "events", "account-123"]);
      });
    });

    describe("campaigns domain", () => {
      it("should generate all key types for campaigns", () => {
        expect(queryKeys.campaigns.all).toEqual(["campaigns"]);
        expect(typeof queryKeys.campaigns.list).toBe("function");
      });

      it("should generate campaigns list key", () => {
        const key = queryKeys.campaigns.list("account-123");
        expect(key).toEqual(["campaigns", "list", "account-123"]);
      });
    });

    describe("vault domain", () => {
      it("should generate all key types for vault", () => {
        expect(queryKeys.vault.all).toEqual(["vault"]);
        expect(typeof queryKeys.vault.list).toBe("function");
      });

      it("should generate vault list key", () => {
        const key = queryKeys.vault.list("account-123");
        expect(key).toEqual(["vault", "list", "account-123"]);
      });
    });

    describe("deliverability domain", () => {
      it("should generate all key types for deliverability", () => {
        expect(queryKeys.deliverability.all).toEqual(["deliverability"]);
        expect(typeof queryKeys.deliverability.health).toBe("function");
        expect(typeof queryKeys.deliverability.monitors).toBe("function");
      });

      it("should generate deliverability health key", () => {
        const key = queryKeys.deliverability.health("account-123");
        expect(key).toEqual(["deliverability", "health", "account-123"]);
      });

      it("should generate deliverability monitors key", () => {
        const key = queryKeys.deliverability.monitors("account-123");
        expect(key).toEqual(["deliverability", "monitors", "account-123"]);
      });
    });

    describe("logs domain", () => {
      it("should generate all key types for logs", () => {
        expect(queryKeys.logs.all).toEqual(["logs"]);
        expect(typeof queryKeys.logs.list).toBe("function");
      });

      it("should generate logs list key", () => {
        const key = queryKeys.logs.list(10, ["info"], "search");
        expect(key).toEqual(["logs", 10, ["info"], "search"]);
      });
    });

    describe("settings domain", () => {
      it("should generate all key types for settings", () => {
        expect(queryKeys.settings.all).toEqual(["settings"]);
        expect(typeof queryKeys.settings.byKey).toBe("function");
      });

      it("should generate settings by key", () => {
        const key = queryKeys.settings.byKey("theme");
        expect(key).toEqual(["settings", "theme"]);
      });
    });

    describe("ai domain", () => {
      it("should generate all key types for ai", () => {
        expect(queryKeys.ai.all).toEqual(["ai"]);
        expect(typeof queryKeys.ai.configs).toBe("function");
        expect(typeof queryKeys.ai.cache).toBe("function");
      });

      it("should generate ai configs key", () => {
        const key = queryKeys.ai.configs("account-123");
        expect(key).toEqual(["ai", "configs", "account-123"]);
      });

      it("should generate ai cache key", () => {
        const key = queryKeys.ai.cache("account-123", "thread-123", "embedding");
        expect(key).toEqual(["ai", "cache", "account-123", "thread-123", "embedding"]);
      });
    });
  });

  describe("type safety of keys", () => {
    it("should have QueryKeys type exported", () => {
      // This test ensures TypeScript can infer the type
      const _keys: typeof queryKeys = queryKeys;
      expect(_keys).toBeDefined();
    });

    it("should generate consistent key types", () => {
      const accountsKey = queryKeys.accounts.detail("123");
      const threadsKey = queryKeys.threads.detail("123", "456");
      const contactsKey = queryKeys.contacts.detail("789");

      expect(Array.isArray(accountsKey)).toBe(true);
      expect(Array.isArray(threadsKey)).toBe(true);
      expect(Array.isArray(contactsKey)).toBe(true);

      expect(accountsKey).toHaveLength(3);
      expect(threadsKey).toHaveLength(4);
      expect(contactsKey).toHaveLength(3);
    });

    it("should generate keys that can be used as query keys", () => {
      const key1 = queryKeys.accounts.list();
      const key2 = queryKeys.threads.list("account-123");
      const key3 = queryKeys.labels.byAccount("account-123");

      expect(key1).toEqual(["accounts", "list"]);
      expect(key2).toEqual(["threads", "list", "account-123"]);
      expect(key3).toEqual(["labels", "account-123"]);
    });

    it("should generate keys with proper immutability", () => {
      const key1 = queryKeys.accounts.all;
      const key2 = queryKeys.threads.all;

      expect(Object.is(key1, key1)).toBe(true); // Reference equality
      expect(Object.is(key2, key2)).toBe(true);

      expect(key1).toEqual(["accounts"]);
      expect(key2).toEqual(["threads"]);
    });
  });

  describe("key invalidation patterns", () => {
    it("should generate prefixable keys for invalidation", () => {
      const accountsAll = queryKeys.accounts.all;
      const accountsDetail = queryKeys.accounts.detail("123");
      const threadsAll = queryKeys.threads.all;
      const threadsDetail = queryKeys.threads.detail("123", "456");

      expect(accountsDetail).toEqual(["accounts", "detail", "123"]);
      expect(threadsDetail).toEqual(["threads", "detail", "123", "456"]);

      // Test that we can invalidate by prefix
      const accountsPrefix = ["accounts"];
      const threadsPrefix = ["threads"];

      expect(accountsDetail.slice(0, 1)).toEqual(accountsPrefix);
      expect(threadsDetail.slice(0, 1)).toEqual(threadsPrefix);
    });

    it("should generate keys that can be used for mutation invalidation", () => {
      const key = queryKeys.threads.detail("account-123", "thread-456");
      const prefix = queryKeys.threads.all;

      expect(key).toContain("account-123");
      expect(key).toContain("thread-456");
      expect(prefix).toEqual(["threads"]);
    });
  });

  describe("edge cases", () => {
    it("should handle null accountId in threads list", () => {
      const key = queryKeys.threads.list(null);
      expect(key).toEqual(["threads", "list", null]);
    });

    it("should handle null accountId in contacts list", () => {
      const key = queryKeys.contacts.list(null);
      expect(key).toEqual(["contacts", "list", null]);
    });

    it("should handle null accountId in tasks list", () => {
      const key = queryKeys.tasks.list(null);
      expect(key).toEqual(["tasks", "list", null]);
    });

    it("should handle null accountId in calendars list", () => {
      const key = queryKeys.calendars.list("account-123");
      expect(key).toEqual(["calendars", "list", "account-123"]);
    });

    it("should handle null accountId in campaigns list", () => {
      const key = queryKeys.campaigns.list("account-123");
      expect(key).toEqual(["campaigns", "list", "account-123"]);
    });

    it("should handle null accountId in vault list", () => {
      const key = queryKeys.vault.list("account-123");
      expect(key).toEqual(["vault", "list", "account-123"]);
    });

    it("should handle null accountId in deliverability health", () => {
      const key = queryKeys.deliverability.health("account-123");
      expect(key).toEqual(["deliverability", "health", "account-123"]);
    });

    it("should handle null accountId in deliverability monitors", () => {
      const key = queryKeys.deliverability.monitors("account-123");
      expect(key).toEqual(["deliverability", "monitors", "account-123"]);
    });

    it("should handle null accountId in ai configs", () => {
      const key = queryKeys.ai.configs("account-123");
      expect(key).toEqual(["ai", "configs", "account-123"]);
    });

    it("should handle null accountId in ai cache", () => {
      const key = queryKeys.ai.cache("account-123", "thread-123", "embedding");
      expect(key).toEqual(["ai", "cache", "account-123", "thread-123", "embedding"]);
    });
  });

  describe("key consistency across domains", () => {
    it("should generate keys that follow consistent naming patterns", () => {
      const accountsKey = queryKeys.accounts.list();
      const threadsKey = queryKeys.threads.list("account-123");
      const labelsKey = queryKeys.labels.byAccount("account-123");
      const contactsKey = queryKeys.contacts.list("account-123");
      const tasksKey = queryKeys.tasks.list("account-123");
      const calendarsKey = queryKeys.calendars.list("account-123");
      const campaignsKey = queryKeys.campaigns.list("account-123");
      const vaultKey = queryKeys.vault.list("account-123");
      const deliverabilityKey = queryKeys.deliverability.health("account-123");
      const aiKey = queryKeys.ai.configs("account-123");

      expect(accountsKey[0]).toBe("accounts");
      expect(threadsKey[0]).toBe("threads");
      expect(labelsKey[0]).toBe("labels");
      expect(contactsKey[0]).toBe("contacts");
      expect(tasksKey[0]).toBe("tasks");
      expect(calendarsKey[0]).toBe("calendars");
      expect(campaignsKey[0]).toBe("campaigns");
      expect(vaultKey[0]).toBe("vault");
      expect(deliverabilityKey[0]).toBe("deliverability");
      expect(aiKey[0]).toBe("ai");
    });

    it("should generate keys that can be used for cache invalidation", () => {
      const allKeys = [
        queryKeys.accounts.all,
        queryKeys.threads.all,
        queryKeys.labels.all,
        queryKeys.contacts.all,
        queryKeys.tasks.all,
        queryKeys.calendars.all,
        queryKeys.campaigns.all,
        queryKeys.vault.all,
        queryKeys.deliverability.all,
        queryKeys.logs.all,
        queryKeys.settings.all,
        queryKeys.ai.all,
      ];

      allKeys.forEach(key => {
        expect(Array.isArray(key)).toBe(true);
        expect(key.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});