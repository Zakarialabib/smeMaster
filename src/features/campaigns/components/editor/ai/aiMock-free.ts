// Thin AI helper for the campaign editor's AI Copilot panel.
//
// This is intentionally provider-agnostic and contains NO canned/mock text.
// It lazily imports the real `callAi` from the shared AI service so the
// provider is only loaded when an AI call is actually made (avoids eager
// load of Tauri/provider machinery on first paint).

/**
 * Send a system + user prompt to the real, configured AI provider.
 *
 * @param system  System prompt that sets the assistant's role/constraints.
 * @param user    The user content (topic, source text, or instruction).
 * @returns       The provider's completion text.
 * @throws        Re-throws the underlying AiError from callAi on failure.
 */
export async function generateWithAi(system: string, user: string): Promise<string> {
  const { callAi } = await import("@shared/services/ai/aiService");
  return callAi(system, user);
}
