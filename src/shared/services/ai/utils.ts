export const LANGUAGE_MAP: Record<string, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
  ja: "Japanese",
  it: "Italian",
};

export function buildSystemPrompt(basePrompt: string, aiLanguage: string): string {
  if (aiLanguage === "auto") return basePrompt;
  const langName = LANGUAGE_MAP[aiLanguage];
  if (!langName) return basePrompt;
  return `${basePrompt}\n\nRespond in ${langName}.`;
}
