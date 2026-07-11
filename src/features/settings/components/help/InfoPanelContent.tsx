import { getContextualHelp } from "@/constants/contextualHelp";

interface InfoPanelContentProps {
  infoKey: string;
}

/**
 * Renders full help entry content for use in SlidePanel.
 * Looks up the infoKey in the contextual help registry and displays
 * the description + tips.
 */
export function InfoPanelContent({ infoKey }: InfoPanelContentProps) {
  const entry = getContextualHelp(infoKey);
  if (!entry) return <p className="text-text-tertiary italic">Help content not found.</p>;

  return (
    <>
      <p>{entry.description}</p>

      {entry.tips && entry.tips.length > 0 && (
        <div className="pt-2">
          <h4 className="text-[0.625rem] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Tips
          </h4>
          <ul className="space-y-1.5">
            {entry.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-accent mt-0.5 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
