// src/features/onboarding/types.ts

export type DemoPresetId = "solo_freelancer" | "small_team" | "sales_focused" | "custom" | "skip";

export type ThemeMode = "light" | "dark" | "system";

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
}

export interface OnboardingData {
  step: number;
  businessName: string;
  theme: ThemeMode;
  tools: ToolSelections;
  demoPreset: DemoPresetId | null;
  accountSkipped: boolean;
  emailConnected: boolean;
  acknowledgedPro: boolean;
}

export interface StepConfig {
  id: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: StepConfig[] = [
  { id: "welcome", title: "Welcome", description: "Theme & Profile" },
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
};
