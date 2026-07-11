export interface PreSendCheckResult {
  category: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export function getSpamScoreLabel(score: number): string {
  if (score <= 20) return "Safe";
  if (score <= 50) return "Moderate";
  if (score <= 80) return "Risky";
  return "High Risk";
}

export async function runPreSendChecklist(params: {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
  toEmails: string[];
}): Promise<PreSendCheckResult[]> {
  const results: PreSendCheckResult[] = [];

  if (!params.subject) {
    results.push({ category: "subject", label: "Subject line", status: "fail", message: "Subject line is empty" });
  } else if (params.subject.includes("FREE") || params.subject.includes("!!!") || params.subject.toUpperCase() === params.subject) {
    results.push({ category: "subject", label: "Spam trigger words", status: "warn", message: "Subject may contain spam trigger patterns" });
  } else {
    results.push({ category: "subject", label: "Subject line", status: "pass", message: "Subject looks good" });
  }

  const content = (params.bodyText + params.bodyHtml).toLowerCase();
  const spamWords = ["free", "click here", "act now", "limited time", "congratulations", "winner", "guaranteed", "urgent"];
  const foundSpamWords = spamWords.filter(w => content.includes(w));
  if (foundSpamWords.length > 2) {
    results.push({ category: "content", label: "Spam words", status: "warn", message: `Found ${foundSpamWords.length} spam trigger words` });
  } else {
    results.push({ category: "content", label: "Spam words", status: "pass", message: "No excessive spam words" });
  }

  const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
  if (linkCount > 10) {
    results.push({ category: "links", label: "Link count", status: "warn", message: `${linkCount} links detected — may trigger spam filters` });
  } else {
    results.push({ category: "links", label: "Link count", status: "pass", message: `${linkCount} links found` });
  }

  const imgCount = (content.match(/<img[^>]+>/g) || []).length;
  const textLength = params.bodyText.length;
  if (imgCount > 3 && textLength < 100) {
    results.push({ category: "images", label: "Image-to-text ratio", status: "warn", message: "High image-to-text ratio — may appear as promotional" });
  } else {
    results.push({ category: "images", label: "Image-to-text ratio", status: "pass", message: "Good balance" });
  }

  if (params.fromEmail.includes("noreply") || params.fromEmail.includes("no-reply")) {
    results.push({ category: "sender", label: "Reply-to address", status: "warn", message: "No-reply address may reduce engagement" });
  } else {
    results.push({ category: "sender", label: "Reply-to address", status: "pass", message: "Reply-to is set" });
  }

  return results;
}
