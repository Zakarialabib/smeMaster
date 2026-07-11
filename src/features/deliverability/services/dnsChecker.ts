export interface DnsCheckResult {
  record: string;
  status: "pass" | "fail" | "error";
  value: string;
  detail: string;
}

export async function checkDomainDns(domain: string): Promise<DnsCheckResult[]> {
  const results: DnsCheckResult[] = [];

  try {
    const spfResult = await queryDnsTxt(domain);
    const spfRecord = spfResult.find(r => r.includes("v=spf1"));
    results.push({
      record: "SPF",
      status: spfRecord ? "pass" : "fail",
      value: spfRecord || "No SPF record found",
      detail: spfRecord ? "SPF record configured" : "Add an SPF record to authorize sending servers",
    });

    const dkimSelectors = ["default", "google", "selector1", "selector2", "dkim", "mail"];
    let dkimFound = false;
    for (const selector of dkimSelectors) {
      const dkimResult = await queryDnsTxt(`${selector}._domainkey.${domain}`);
      if (dkimResult.some(r => r.includes("v=DKIM1"))) {
        dkimFound = true;
        results.push({
          record: "DKIM",
          status: "pass",
          value: `Found ${selector}._domainkey`,
          detail: `DKIM record found with selector "${selector}"`,
        });
        break;
      }
    }
    if (!dkimFound) {
      results.push({
        record: "DKIM",
        status: "fail",
        value: "No DKIM record found",
        detail: "Add a DKIM record to sign outgoing emails",
      });
    }

    const dmarcResult = await queryDnsTxt(`_dmarc.${domain}`);
    const dmarcRecord = dmarcResult.find(r => r.includes("v=DMARC1"));
    results.push({
      record: "DMARC",
      status: dmarcRecord ? "pass" : "fail",
      value: dmarcRecord || "No DMARC record found",
      detail: dmarcRecord ? "DMARC policy configured" : "Add a DMARC record to prevent spoofing",
    });
  } catch (err) {
    results.push({
      record: "DNS",
      status: "error",
      value: String(err),
      detail: "Failed to query DNS records",
    });
  }

  return results;
}

export async function getDnsHealthScore(results: DnsCheckResult[]): Promise<number> {
  const passed = results.filter(r => r.status === "pass").length;
  return Math.round((passed / Math.max(1, results.length)) * 100);
}

async function queryDnsTxt(hostname: string): Promise<string[]> {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=TXT`);
  if (!response.ok) throw new Error(`DNS query failed: ${response.status}`);
  const data = await response.json();
  return (data.Answer || []).map((a: { data: string }) => a.data.replace(/"/g, ""));
}
