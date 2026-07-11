import { callAi } from "./aiService";
import type { TemplateDemo } from "@features/mail/constants/templateDemos";
import type { CampaignTemplate } from "@/constants/campaignTemplates";

const DEMO_GENERATION_PROMPT = `You are a demo walkthrough generator. Output ONLY valid JSON with no markdown, no code fences, no extra text.

You MUST output exactly this structure:
{
  "name": "string — demo name",
  "screens": [
    {
      "title": "string — step title (max 40 chars)",
      "description": "string — what happens in this step (max 80 chars)",
      "simulatedAction": "string — simulated action text like '✍️ AI drafting reply...' (max 100 chars)",
      "duration": number — milliseconds to show this step (2000-4000)
    }
  ]
}

RULES:
- Exactly 6-8 screens
- Each screen builds on the previous
- Total duration should be 20-30 seconds
- Simulated actions should use emoji prefixes
- Titles should be short and clear`;

let _demoCounter = 0;

function nextDemoId(): string {
  _demoCounter++;
  return `ai-demo-${_demoCounter}-${Date.now()}`;
}

export async function generateDemoForTemplate(
  template: CampaignTemplate
): Promise<TemplateDemo> {
  const userContent = `Create a demo walkthrough for this email template:
Name: ${template.name}
Description: ${template.description}
Category: ${template.category}`;
  const raw = await callAi(DEMO_GENERATION_PROMPT, userContent);
  try {
    const parsed = JSON.parse(raw) as {
      name: string;
      screens: Array<{
        title: string;
        description: string;
        simulatedAction: string;
        duration: number;
      }>;
    };
    const totalDuration = parsed.screens.reduce((sum, s) => sum + s.duration, 0);
    return {
      id: nextDemoId(),
      templateIds: [template.id],
      name: parsed.name,
      duration: Math.round(totalDuration / 1000),
      screens: parsed.screens,
    };
  } catch {
    throw new Error(`Failed to parse demo generation output: ${raw.slice(0, 200)}`);
  }
}

export async function generateDemoFromDescription(
  name: string,
  features: string[]
): Promise<TemplateDemo> {
  const userContent = `Create a demo walkthrough titled "${name}" covering these features:\n${features.map((f) => `- ${f}`).join('\n')}`;
  const raw = await callAi(DEMO_GENERATION_PROMPT, userContent);
  try {
    const parsed = JSON.parse(raw) as {
      name: string;
      screens: Array<{
        title: string;
        description: string;
        simulatedAction: string;
        duration: number;
      }>;
    };
    const totalDuration = parsed.screens.reduce((sum, s) => sum + s.duration, 0);
    return {
      id: nextDemoId(),
      templateIds: [],
      name: parsed.name,
      duration: Math.round(totalDuration / 1000),
      screens: parsed.screens,
    };
  } catch {
    throw new Error(`Failed to parse demo from description output: ${raw.slice(0, 200)}`);
  }
}
