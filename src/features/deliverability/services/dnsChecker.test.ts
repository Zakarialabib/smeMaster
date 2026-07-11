import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDnsHealthScore, type DnsCheckResult } from "./dnsChecker";

// We test getDnsHealthScore (pure logic) directly.
// checkDomainDns is tested with a mocked fetch below.

describe("getDnsHealthScore", () => {
  it("returns 100 when all records pass", async () => {
    const results: DnsCheckResult[] = [
      { record: "SPF", status: "pass", value: "v=spf1 ...", detail: "" },
      { record: "DKIM", status: "pass", value: "Found default._domainkey", detail: "" },
      { record: "DMARC", status: "pass", value: "v=DMARC1 ...", detail: "" },
    ];
    expect(await getDnsHealthScore(results)).toBe(100);
  });

  it("returns 0 when no records pass", async () => {
    const results: DnsCheckResult[] = [
      { record: "SPF", status: "fail", value: "", detail: "" },
      { record: "DKIM", status: "fail", value: "", detail: "" },
      { record: "DMARC", status: "fail", value: "", detail: "" },
    ];
    expect(await getDnsHealthScore(results)).toBe(0);
  });

  it("returns 50 when half the records pass", async () => {
    const results: DnsCheckResult[] = [
      { record: "SPF", status: "pass", value: "", detail: "" },
      { record: "DKIM", status: "fail", value: "", detail: "" },
    ];
    expect(await getDnsHealthScore(results)).toBe(50);
  });

  it("returns 0 for empty results array", async () => {
    expect(await getDnsHealthScore([])).toBe(0);
  });

  it("ignores 'error' status records in score calculation", async () => {
    const results: DnsCheckResult[] = [
      { record: "SPF", status: "pass", value: "", detail: "" },
      { record: "DNS", status: "error", value: "timeout", detail: "" },
    ];
    // pass=1, total=2 → 50
    expect(await getDnsHealthScore(results)).toBe(50);
  });

  it("rounds the score to nearest integer", async () => {
    const results: DnsCheckResult[] = [
      { record: "SPF", status: "pass", value: "", detail: "" },
      { record: "DKIM", status: "fail", value: "", detail: "" },
      { record: "DMARC", status: "fail", value: "", detail: "" },
    ];
    // 1/3 = 33.33 → rounds to 33
    expect(await getDnsHealthScore(results)).toBe(33);
  });
});

// ── checkDomainDns with mocked fetch ──

describe("checkDomainDns", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  function mockDnsResponse(records: Record<string, string[]>) {
    return {
      ok: true,
      json: vi.fn().mockResolvedValue({
        Answer: Object.entries(records).flatMap(([name, data]) =>
          data.map((d) => ({ name, data: d })),
        ),
      }),
    };
  }

  it("passes when SPF, DKIM, and DMARC are all present", async () => {
    const { checkDomainDns } = await import("./dnsChecker");

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes("type=TXT")) {
        if (url.includes("_dmarc.")) {
          return mockDnsResponse({ "_dmarc.example.com": ['"v=DMARC1; p=none"' ] });
        }
        if (url.includes("_domainkey")) {
          return mockDnsResponse({ "default._domainkey.example.com": ['"v=DKIM1; k=rsa; ..."' ] });
        }
        if (url.includes("example.com")) {
          return mockDnsResponse({ "example.com": ['"v=spf1 include:_spf.google.com ~all"' ] });
        }
      }
      return mockDnsResponse({});
    });

    const results = await checkDomainDns("example.com");
    expect(results).toHaveLength(3);
    expect(results.find((r) => r.record === "SPF")!.status).toBe("pass");
    expect(results.find((r) => r.record === "DKIM")!.status).toBe("pass");
    expect(results.find((r) => r.record === "DMARC")!.status).toBe("pass");
  });

  it("fails SPF when no v=spf1 record is found", async () => {
    const { checkDomainDns } = await import("./dnsChecker");

    fetchSpy.mockImplementation(async () => mockDnsResponse({}));

    const results = await checkDomainDns("example.com");
    const spf = results.find((r) => r.record === "SPF")!;
    expect(spf.status).toBe("fail");
    expect(spf.value).toBe("No SPF record found");
  });

  it("fails DMARC when no v=DMARC1 record is found", async () => {
    const { checkDomainDns } = await import("./dnsChecker");

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes("_dmarc.")) return mockDnsResponse({});
      if (url.includes("_domainkey")) {
        return mockDnsResponse({ "default._domainkey.example.com": ['"v=DKIM1; k=rsa; ..."' ] });
      }
      return mockDnsResponse({ "example.com": ['"v=spf1 ..."' ] });
    });

    const results = await checkDomainDns("example.com");
    const dmarc = results.find((r) => r.record === "DMARC")!;
    expect(dmarc.status).toBe("fail");
    expect(dmarc.value).toBe("No DMARC record found");
  });

  it("tries multiple DKIM selectors and finds one", async () => {
    const { checkDomainDns } = await import("./dnsChecker");

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes("_dmarc.")) return mockDnsResponse({});
      if (url.includes("selector1._domainkey")) {
        return mockDnsResponse({ "selector1._domainkey.example.com": ['"v=DKIM1; k=rsa; ..."' ] });
      }
      if (url.includes("_domainkey")) return mockDnsResponse({});
      return mockDnsResponse({ "example.com": ['"v=spf1 ..."' ] });
    });

    const results = await checkDomainDns("example.com");
    const dkim = results.find((r) => r.record === "DKIM")!;
    expect(dkim.status).toBe("pass");
    expect(dkim.value).toContain("selector1._domainkey");
  });

  it("returns error result when fetch throws", async () => {
    const { checkDomainDns } = await import("./dnsChecker");

    fetchSpy.mockRejectedValue(new Error("Network error"));

    const results = await checkDomainDns("example.com");
    expect(results).toHaveLength(1);
    expect(results[0]!.record).toBe("DNS");
    expect(results[0]!.status).toBe("error");
  });
});
