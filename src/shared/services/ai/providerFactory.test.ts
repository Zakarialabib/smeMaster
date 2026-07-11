import { createProviderFactory } from "./providerFactory";

describe("createProviderFactory", () => {
  it("creates a client on first call", () => {
    const createClient = vi.fn((key: string) => ({ key }));
    const factory = createProviderFactory(createClient);

    const client = factory.getClient("key-1");

    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith("key-1");
    expect(client).toEqual({ key: "key-1" });
  });

  it("returns the cached client for the same key", () => {
    const createClient = vi.fn((key: string) => ({ key }));
    const factory = createProviderFactory(createClient);

    const first = factory.getClient("key-1");
    const second = factory.getClient("key-1");

    expect(createClient).toHaveBeenCalledOnce();
    expect(first).toBe(second);
  });

  it("creates a new client when the key changes", () => {
    const createClient = vi.fn((key: string) => ({ key }));
    const factory = createProviderFactory(createClient);

    const first = factory.getClient("key-1");
    const second = factory.getClient("key-2");

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
    expect(second).toEqual({ key: "key-2" });
  });

  it("re-caches after key change and reuses for repeated calls", () => {
    const createClient = vi.fn((key: string) => ({ key }));
    const factory = createProviderFactory(createClient);

    factory.getClient("key-1");
    const second = factory.getClient("key-2");
    const third = factory.getClient("key-2");

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(second).toBe(third);
  });

  it("creates a fresh client after clear()", () => {
    const createClient = vi.fn((key: string) => ({ key }));
    const factory = createProviderFactory(createClient);

    const first = factory.getClient("key-1");
    factory.clear();
    const second = factory.getClient("key-1");

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("works with different generic types", () => {
    const factory = createProviderFactory((key: string) => ({
      connect: () => `connected-${key}`,
    }));

    const client = factory.getClient("abc");
    expect(client.connect()).toBe("connected-abc");
  });
});
