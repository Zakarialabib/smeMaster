import { callAi } from "./aiService";
import type { WorkflowPreset } from "@/constants/workflowPresets";

const WORKFLOW_GENERATION_PROMPT = `You are a workflow automation generator. Output ONLY valid JSON with no markdown, no code fences, no extra text.

You MUST output exactly this structure:
{
  "name": "string — descriptive name",
  "description": "string — 1 sentence",
  "trigger_event": "email_received|no_reply_after_days|time_based|label_applied|starred",
  "trigger_conditions": "stringified JSON object",
  "actions": "stringified JSON array of action objects",
  "category": "automation|ai_enhanced"
}

RULES:
- trigger_conditions is a JSON string, not an object
- actions is a JSON string, not an array in the output JSON (it's a string that can be parsed as JSON)
- Valid action types: archive, star, apply_label, forward_to, create_task, send_template, send_notification
- Category is 'automation' for basic, 'ai_enhanced' for AI-powered workflows`;

let _workflowCounter = 0;

function nextWorkflowId(): string {
  _workflowCounter++;
  return `ai-generated-${_workflowCounter}-${Date.now()}`;
}

function parseWorkflowPreset(raw: string): WorkflowPreset {
  const parsed = JSON.parse(raw) as {
    name: string;
    description: string;
    trigger_event: string;
    trigger_conditions: string;
    actions: string;
    category: 'automation' | 'ai_enhanced';
  };
  return {
    id: nextWorkflowId(),
    name: parsed.name,
    description: parsed.description,
    trigger_event: parsed.trigger_event,
    trigger_conditions: parsed.trigger_conditions,
    actions: parsed.actions,
    category: parsed.category,
  };
}

export async function generateWorkflowPreset(
  description: string
): Promise<WorkflowPreset> {
  const userContent = `Create a workflow preset for: ${description}`;
  const raw = await callAi(WORKFLOW_GENERATION_PROMPT, userContent);
  try {
    return parseWorkflowPreset(raw);
  } catch {
    throw new Error(`Failed to parse workflow preset output: ${raw.slice(0, 200)}`);
  }
}

export async function generateWorkflowPresets(
  count: number,
  category?: 'automation' | 'ai_enhanced'
): Promise<WorkflowPreset[]> {
  const userContent = `Generate ${count} workflow presets${category ? ` in category: ${category}` : ''}. Output a JSON array.`;
  const raw = await callAi(WORKFLOW_GENERATION_PROMPT, userContent);
  try {
    const items = JSON.parse(raw) as Array<{
      name: string;
      description: string;
      trigger_event: string;
      trigger_conditions: string;
      actions: string;
      category: 'automation' | 'ai_enhanced';
    }>;
    return items.map((item) => ({
      id: nextWorkflowId(),
      name: item.name,
      description: item.description,
      trigger_event: item.trigger_event,
      trigger_conditions: item.trigger_conditions,
      actions: item.actions,
      category: item.category,
    }));
  } catch {
    throw new Error(`Failed to parse workflow presets output: ${raw.slice(0, 200)}`);
  }
}
