export interface ContentQualityResult {
  overallScore: number;
  clarity: number;
  engagement: number;
  readability: number;
  suggestions: string[];
  wordCount: number;
  readingTimeSeconds: number;
}

export async function analyzeContentQuality(content: string): Promise<ContentQualityResult> {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const readingTimeSeconds = Math.ceil((wordCount / 200) * 60);
  const sentences = content.split(/[.!?]+/).filter(Boolean);
  const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : 0;

  const clarity = Math.min(100, Math.max(0, 100 - Math.abs(avgWordsPerSentence - 15) * 5));
  const hasQuestions = content.includes("?") ? 10 : 0;
  const hasCta = /click|sign up|download|learn more|get started/i.test(content) ? 15 : 0;
  const hasPersonalization = /\{\{(first_name|name|email|company)\}\}/i.test(content) ? 10 : 0;
  const engagement = Math.min(100, hasQuestions + hasCta + hasPersonalization + 50);

  const readability = wordCount < 50 ? 80 : wordCount > 500 ? 50 : 90;

  const suggestions: string[] = [];
  if (avgWordsPerSentence > 25) suggestions.push("Some sentences are too long — consider breaking them up");
  if (wordCount < 50) suggestions.push("Content is very short — consider adding more detail");
  if (wordCount > 500) suggestions.push("Content is very long — consider trimming to improve engagement");
  if (!hasCta) suggestions.push("Add a clear call-to-action to improve response rates");
  if (!content.includes("?")) suggestions.push("Asking a question can increase engagement");

  const overallScore = Math.round((clarity + engagement + readability) / 3);

  return { overallScore, clarity, engagement, readability, suggestions, wordCount, readingTimeSeconds };
}
