import { callAi } from "./aiService";

export interface GeneratedTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  html: string;
  variables: string[];
}

const TEMPLATE_GENERATION_PROMPT = `You are an email template generator. Output ONLY valid JSON with no markdown, no code fences, no extra text.

You MUST output exactly this structure:
{
  "name": "string — short, descriptive name",
  "description": "string — 1 sentence describing the template",
  "category": "announcement|newsletter|promotion|follow-up|event|welcome|feedback|invoice|meeting|holiday",
  "html": "string — full HTML email (table-based, inline styles, responsive, 560px max-width)",
  "variables": ["string array of variable names like company, content, subject"]
}

RULES (DO NOT VIOLATE):
- html MUST be a complete email with <html><body> structure
- Use ONLY inline styles, no <style> tags
- Max width 560px, centered
- Include unsubscribe link in footer
- Variables use {{variable_name}} syntax
- Category MUST be exactly one of the listed values
- Description MUST be a single sentence
- Name MUST be max 50 chars`;

export async function generateTemplate(
  description: string,
  category?: string,
  style?: string
): Promise<GeneratedTemplate> {
  const userContent = `Create an email template. Description: ${description}${category ? `\nCategory: ${category}` : ''}${style ? `\nStyle: ${style}` : ''}`;
  const raw = await callAi(TEMPLATE_GENERATION_PROMPT, userContent);
  try {
    return JSON.parse(raw) as GeneratedTemplate;
  } catch {
    throw new Error(`Failed to parse template generation output: ${raw.slice(0, 200)}`);
  }
}

export async function regenerateTemplate(
  description: string,
  previousHtml: string,
  feedback: string
): Promise<GeneratedTemplate> {
  const userContent = `Previous template HTML: ${previousHtml.slice(0, 500)}\n\nFeedback: ${feedback}\n\nDescription: ${description}\n\nRegenerate the template based on this feedback.`;
  const raw = await callAi(TEMPLATE_GENERATION_PROMPT, userContent);
  try {
    return JSON.parse(raw) as GeneratedTemplate;
  } catch {
    throw new Error(`Failed to parse regenerated template output: ${raw.slice(0, 200)}`);
  }
}
