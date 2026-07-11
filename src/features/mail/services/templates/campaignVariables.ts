/**
 * @deprecated Use shared/utils/templateVariables instead.
 * This file is kept as a thin re-export wrapper for backward compatibility.
 */
export {
  evaluateConditionalBlocks,
  interpolateVariables as resolveCampaignVariablesInPipeline,
  TEMPLATE_VARIABLES,
  interpolateVariables,
  interpolateVariablesSync,
} from "@shared/utils/templateVariables";

export type { TemplateContext } from "@shared/utils/templateVariables";

export const GREETINGS: Record<string, string[]> = {
  en: ["Hello", "Hi", "Hey", "Greetings"],
  fr: ["Bonjour", "Salut", "Coucou"],
  de: ["Hallo", "Hallo", "Guten Tag"],
  es: ["Hola", "Buenos días"],
  zh: ["您好", "你好"],
  ja: ["こんにちは"],
  ar: ["مرحبا", "أهلا"],
  pt: ["Olá", "Oi"],
  it: ["Ciao", "Buongiorno"],
  nl: ["Hallo", "Hoi"],
};
