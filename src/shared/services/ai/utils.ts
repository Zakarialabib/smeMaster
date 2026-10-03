import { z } from 'zod';

export const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
  ja: 'Japanese',
  it: 'Italian',
};

export function buildSystemPrompt(basePrompt: string, aiLanguage: string): string {
  if (aiLanguage === 'auto') return basePrompt;
  const langName = LANGUAGE_MAP[aiLanguage];
  if (!langName) return basePrompt;
  return `${basePrompt}\n\nRespond in ${langName}.`;
}

/**
 * Convert a Zod schema to JSON Schema for structured output / tool calling.
 *
 * Delegates to Zod 4's native `z.toJSONSchema()` — the previous hand-rolled
 * converter switched on `schema._def.typeName`, a Zod 3 internal that Zod 4
 * removed (`_def` now carries `type`), so it silently produced empty schemas.
 *
 * The `$schema` draft key is stripped because OpenAI, Gemini, Mistral and
 * BytePlus reject unknown top-level keys in their schema payloads.
 */
export function zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}
