import { callAi } from "./aiService";
import type { WarmupPreset } from "@/constants/warmupPresets";

const WARMUP_GENERATION_PROMPT = `You are an email warmup content generator. Output ONLY valid JSON with no markdown, no code fences, no extra text.

You MUST output exactly this structure:
{
  "name": "string — descriptive name",
  "subject": "string — email subject line",
  "bodyHtml": "string — HTML body with <p> tags and line breaks",
  "style": "follow_up|thank_you|introduction|meeting_request|check_in|sharing_content"
}

RULES:
- Body must be short (3-5 sentences max)
- Sound natural, professional but friendly
- Include {{first_name}} and {{my_name}} variables
- NO sales pitch, NO calls-to-action (this is warming, not marketing)
- Subject max 60 chars`;

let _warmupCounter = 0;

function nextWarmupId(): string {
  _warmupCounter++;
  return `ai-warmup-${_warmupCounter}-${Date.now()}`;
}

export async function generateWarmupPreset(params: {
  style: WarmupPreset['style'];
  tone?: string;
  context?: string;
}): Promise<WarmupPreset> {
  const { style, tone, context } = params;
  const userContent = `Create a warmup email preset.
Style: ${style}${tone ? `\nTone: ${tone}` : ''}${context ? `\nContext: ${context}` : ''}`;
  const raw = await callAi(WARMUP_GENERATION_PROMPT, userContent);
  try {
    const parsed = JSON.parse(raw) as {
      name: string;
      subject: string;
      bodyHtml: string;
      style: WarmupPreset['style'];
    };
    return {
      id: nextWarmupId(),
      name: parsed.name,
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml,
      style: parsed.style,
    };
  } catch {
    throw new Error(`Failed to parse warmup preset output: ${raw.slice(0, 200)}`);
  }
}
