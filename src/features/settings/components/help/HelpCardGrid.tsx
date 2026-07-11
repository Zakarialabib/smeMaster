import { HelpPageCard } from "./HelpPageCard";
import type { HelpCard as HelpCardData } from "@/constants/helpContent";

interface HelpCardGridProps {
  cards: HelpCardData[];
  expandedCardId: string | null;
  onToggleCard: (cardId: string) => void;
}

export function HelpCardGrid({ cards, expandedCardId, onToggleCard }: HelpCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {cards.map((card) => (
        <HelpPageCard
          key={card.id}
          card={card}
          isExpanded={expandedCardId === card.id}
          onToggle={() => onToggleCard(card.id)}
        />
      ))}
    </div>
  );
}
