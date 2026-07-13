// src/features/onboarding/steps/demoPresets.ts
import type { DemoPreset } from "../types";

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "solo_freelancer",
    label: "Solo Freelancer",
    description: "Lightweight mail + CRM for independent professionals",
    icon: "User",
    tools: { mail: true, crm: true, campaigns: false, calendar: true, ai: false },
  },
  {
    id: "small_team",
    label: "Small Team",
    description: "Full communication suite with campaigns and calendar",
    icon: "Users",
    tools: { mail: true, crm: true, campaigns: true, calendar: true, ai: true },
  },
  {
    id: "sales_focused",
    label: "Sales Focused",
    description: "CRM-heavy with campaigns, AI outreach, and sync",
    icon: "Target",
    tools: { mail: true, crm: true, campaigns: true, calendar: false, ai: true },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Choose exactly what you need",
    icon: "SlidersHorizontal",
    tools: { mail: true, crm: true, campaigns: false, calendar: false, ai: false },
  },
];
