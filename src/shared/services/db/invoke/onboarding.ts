// src/shared/services/db/invoke/onboarding.ts
import { invokeCommand } from './command';

export async function saveOnboardingStep(step: number, data: string): Promise<void> {
  await invokeCommand("db_save_onboarding_step", { step, data });
}

export async function getOnboardingProgress(): Promise<[number, string]> {
  return await invokeCommand<[number, string]>("db_get_onboarding_progress", {});
}

export async function seedDemoPreset(preset: string, businessName: string, theme: string): Promise<string> {
  return await invokeCommand<string>("db_seed_demo_preset", { preset, businessName, theme });
}

export async function finalizeOnboarding(params: {
  businessName: string;
  theme: string;
  enableMail: boolean;
  enableCrm: boolean;
  enableCampaigns: boolean;
  enableCalendar: boolean;
  enableAi: boolean;
  hasConnectedEmail: boolean;
}): Promise<void> {
  await invokeCommand("db_finalize_onboarding", params);
}

export async function hasEmailAccounts(): Promise<boolean> {
  return await invokeCommand<boolean>("db_has_email_accounts", {});
}

export async function getToolStatus(): Promise<Record<string, boolean>> {
  return await invokeCommand<Record<string, boolean>>("db_get_tool_status", {});
}
