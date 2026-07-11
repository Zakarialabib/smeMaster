// src/features/onboarding/types.ts

export type BusinessType = "solo" | "small_team" | "sales" | "other";

export type DemoPresetId = "solo_freelancer" | "small_team" | "sales_focused" | "custom";

export interface DemoPreset {
  id: DemoPresetId;
  label: string;
  description: string;
  icon: string;
  tools: ToolSelections;
}

export interface ToolSelections {
  mail: boolean;
  crm: boolean;
  campaigns: boolean;
  calendar: boolean;
  ai: boolean;
  sync: boolean;
}

export interface OnboardingData {
  businessName: string;
  businessType: BusinessType;
  tools: ToolSelections;
  demoPreset: DemoPresetId | null;
  accountSkipped: boolean;
}

export interface StepConfig {
  id: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: StepConfig[] = [
  { id: "welcome", title: "Welcome", description: "Language & Profile" },
  { id: "tools", title: "Features", description: "Choose Capabilities" },
  { id: "account", title: "Account", description: "Connect Email" },
  { id: "complete", title: "Ready", description: "Launch" },
];

export const DEFAULT_TOOLS: ToolSelections = {
  mail: true,
  crm: true,
  campaigns: false,
  calendar: false,
  ai: false,
  sync: false,
};
