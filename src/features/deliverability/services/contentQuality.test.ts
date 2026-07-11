import { describe, it, expect } from "vitest";
import { analyzeContentQuality } from "./contentQuality";

describe("analyzeContentQuality", () => {
  it("returns correct wordCount and readingTimeSeconds", async () => {
    const content = "Hello world this is a test email with ten words here today";
    const result = await analyzeContentQuality(content);
    expect(result.wordCount).toBe(12);
    expect(result.readingTimeSeconds).toBe(Math.ceil((12 / 200) * 60));
  });

  it("computes readability as 80 for short content (< 50 words)", async () => {
    const short = Array(40).fill("word").join(" ");
    const result = await analyzeContentQuality(short);
    expect(result.readability).toBe(80);
  });

  it("computes readability as 90 for medium content (50–500 words)", async () => {
    const medium = Array(100).fill("word").join(" ");
    const result = await analyzeContentQuality(medium);
    expect(result.readability).toBe(90);
  });

  it("computes readability as 50 for long content (> 500 words)", async () => {
    const long = Array(600).fill("word").join(" ");
    const result = await analyzeContentQuality(long);
    expect(result.readability).toBe(50);
  });

  it("clarity peaks when avg words per sentence is ~15", async () => {
    // 15 words per sentence → abs(15-15)*5 = 0 → clarity = 100
    const sentences = Array.from({ length: 3 }, () =>
      Array(15).fill("word").join(" ")
    ).join(". ");
    const result = await analyzeContentQuality(sentences);
    expect(result.clarity).toBe(100);
  });

  it("clarity degrades with very long sentences", async () => {
    // 50 words in one sentence → abs(50-15)*5 = 175 → 100 - 175 = clamped to 0
    const longSentence = Array(50).fill("word").join(" ");
    const result = await analyzeContentQuality(longSentence);
    expect(result.clarity).toBe(0);
  });

  it("engagement increases with a question mark", async () => {
    const withQ = "Do you have any questions about this proposal?";
    const withoutQ = "I hope this proposal looks good to you";
    const r1 = await analyzeContentQuality(withQ);
    const r2 = await analyzeContentQuality(withoutQ);
    expect(r1.engagement).toBeGreaterThan(r2.engagement);
  });

  it("engagement increases with a CTA", async () => {
    const withCta = "Click here to sign up for our service";
    const withoutCta = "I wanted to share some information with you";
    const r1 = await analyzeContentQuality(withCta);
    const r2 = await analyzeContentQuality(withoutCta);
    expect(r1.engagement).toBeGreaterThan(r2.engagement);
  });

  it("engagement increases with personalization tokens", async () => {
    const withP = "Hello {{first_name}}, welcome to our platform";
    const withoutP = "Hello friend, welcome to our platform";
    const r1 = await analyzeContentQuality(withP);
    const r2 = await analyzeContentQuality(withoutP);
    expect(r1.engagement).toBeGreaterThanOrEqual(r2.engagement);
  });

  it("engagement is capped at 100", async () => {
    const max = "Click to download? {{name}} {{first_name}} {{email}} {{company}} sign up get started learn more";
    const result = await analyzeContentQuality(max);
    expect(result.engagement).toBeLessThanOrEqual(100);
  });

  it("overallScore is average of clarity, engagement, readability", async () => {
    const content = "Hello world, this is a simple test message with a question?";
    const result = await analyzeContentQuality(content);
    const expected = Math.round((result.clarity + result.engagement + result.readability) / 3);
    expect(result.overallScore).toBe(expected);
  });

  it("suggests breaking up long sentences", async () => {
    // 30 words in one sentence
    const longSent = Array(30).fill("word").join(" ");
    const result = await analyzeContentQuality(longSent);
    expect(result.suggestions).toContain(
      "Some sentences are too long — consider breaking them up",
    );
  });

  it("suggests adding more detail for very short content", async () => {
    const short = Array(20).fill("word").join(" ");
    const result = await analyzeContentQuality(short);
    expect(result.suggestions).toContain(
      "Content is very short — consider adding more detail",
    );
  });

  it("suggests trimming for very long content", async () => {
    const long = Array(600).fill("word").join(" ");
    const result = await analyzeContentQuality(long);
    expect(result.suggestions).toContain(
      "Content is very long — consider trimming to improve engagement",
    );
  });

  it("suggests adding a CTA when none present", async () => {
    const content = "Just sharing some information with you today";
    const result = await analyzeContentQuality(content);
    expect(result.suggestions).toContain(
      "Add a clear call-to-action to improve response rates",
    );
  });

  it("suggests asking a question when none present", async () => {
    const content = "I am writing to inform you about our upcoming changes";
    const result = await analyzeContentQuality(content);
    expect(result.suggestions).toContain(
      "Asking a question can increase engagement",
    );
  });

  it("does not suggest breaking up short sentences", async () => {
    // Short sentences: 5 words each
    const shortSentences = "Hello world. This is nice. Good day today. Thanks a lot.";
    const result = await analyzeContentQuality(shortSentences);
    expect(result.suggestions).not.toContain(
      "Some sentences are too long — consider breaking them up",
    );
  });

  it("handles empty content gracefully", async () => {
    const result = await analyzeContentQuality("");
    expect(result.wordCount).toBe(0);
    expect(result.readingTimeSeconds).toBe(Math.ceil((0 / 200) * 60));
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("handles single word content", async () => {
    const result = await analyzeContentQuality("Hello");
    expect(result.wordCount).toBe(1);
    expect(result.readability).toBe(80);
  });
});
