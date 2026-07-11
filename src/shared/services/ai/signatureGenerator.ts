import { callAi } from "./aiService";

export interface GeneratedSignature {
  id: string;
  name: string;
  html: string;
  variables: string[];
}

const SIGNATURE_GENERATION_PROMPT = `You are an email signature generator. Output ONLY valid JSON with no markdown, no code fences, no extra text.

You MUST output exactly this structure:
{
  "name": "string — signature name e.g. 'Modern Professional'",
  "html": "string — full HTML signature (table-based, inline styles)",
  "variables": ["string array of variable names like fullName, title, company, email, phone, website"]
}

RULES (DO NOT VIOLATE):
- Include name, title, company, email at minimum
- Phone and website optional
- Use inline styles only
- Separator line (border-top) before signature
- Social icons optional (use text-based)`;

export async function generateSignature(params: {
  fullName: string;
  title: string;
  company: string;
  email: string;
  phone?: string;
  style?: 'modern' | 'classic' | 'minimal' | 'branded';
}): Promise<GeneratedSignature> {
  const { fullName, title, company, email, phone, style } = params;
  const userContent = `Create an email signature for:
Name: ${fullName}
Title: ${title}
Company: ${company}
Email: ${email}${phone ? `\nPhone: ${phone}` : ''}${style ? `\nStyle: ${style}` : ''}`;
  const raw = await callAi(SIGNATURE_GENERATION_PROMPT, userContent);
  try {
    return JSON.parse(raw) as GeneratedSignature;
  } catch {
    throw new Error(`Failed to parse signature generation output: ${raw.slice(0, 200)}`);
  }
}
