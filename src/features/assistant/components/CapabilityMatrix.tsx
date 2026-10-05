/**
 * CapabilityMatrix — 13-capability × 11-provider grid.
 *
 * Cells are derived from PROVIDER_CAPABILITIES (code), not hand-maintained.
 * Re-renders automatically when the capability map changes.
 *
 * Usage:
 *   <CapabilityMatrix />
 */

import { PROVIDER_CAPABILITIES } from '@shared/services/ai/providerCapabilities';
import type { AiProvider } from '@shared/services/ai/types';
import { ALL_CAPABILITIES } from '@shared/services/ai/capabilities';

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'byteplus', label: 'BytePlus' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'custom', label: 'Custom' },
  { id: 'lmstudio', label: 'LM Studio' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'local', label: 'Local' },
];

export function CapabilityMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-start p-1.5 text-text-tertiary font-medium w-20">Provider</th>
            {ALL_CAPABILITIES.map((cap) => (
              <th
                key={cap.id}
                className="p-1.5 text-text-tertiary font-medium text-center"
                title={cap.description}
              >
                {cap.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROVIDERS.map(({ id, label }) => {
            const caps = (PROVIDER_CAPABILITIES[id] ?? []) as string[];
            return (
              <tr key={id} className="border-b border-border-primary/50">
                <td className="p-1.5 text-text-primary font-medium">{label}</td>
                {ALL_CAPABILITIES.map((cap) => {
                  const supported = caps.includes(cap.id);
                  return (
                    <td key={cap.id} className="p-1.5 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-sm ${supported ? 'bg-success' : 'bg-danger/30'}`}
                        title={
                          supported
                            ? `${label} supports ${cap.label}`
                            : `${label} does not support ${cap.label}`
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
