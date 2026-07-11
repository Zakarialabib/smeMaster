/**
 * CampaignPatterns — visual campaign lifecycle builder.
 *
 * Shows campaign patterns as a visual flow diagram so users can:
 * - See the campaign lifecycle at a glance (Draft → Configure → Schedule → Send)
 * - Discover built-in patterns (newsletter, product launch, drip campaign, etc.)
 * - Click a pattern to pre-fill the CampaignComposer wizard with sensible defaults
 *
 * This implements the "need → search → use" UX pattern:
 *   1. Need: "I want to send a welcome series"
 *   2. Search: browse visual patterns grouped by use-case
 *   3. Use: click to launch the composer pre-configured with that pattern
 */

import { useState, useMemo } from "react";
import {
  Users, Mail, Calendar, Send, Megaphone,
  Bell, Gift, RefreshCw, Sparkles, ChevronRight, Search,
  ArrowRight, FileText, Eye, Layers, Target,
} from "lucide-react";


// ── Lifecycle step definitions ─────────────────────────────────────────────

interface LifecycleStep {
  id: string;
  label: string;
  icon: typeof Users;
  description: string;
  order: number;
}

const LIFECYCLE_STEPS: LifecycleStep[] = [
  { id: "draft", label: "Draft", icon: FileText, description: "Name & describe your campaign", order: 0 },
  { id: "audience", label: "Audience", icon: Users, description: "Select recipients", order: 1 },
  { id: "template", label: "Content", icon: Eye, description: "Pick template & A/B test", order: 2 },
  { id: "schedule", label: "Schedule", icon: Calendar, description: "When to send", order: 3 },
  { id: "send", label: "Launch", icon: Send, description: "Review & send", order: 4 },
];

// ── Pattern interface ──────────────────────────────────────────────────────

export interface CampaignPattern {
  id: string;
  name: string;
  description: string;
  category: "engagement" | "sales" | "onboarding" | "retention" | "seasonal";
  icon: typeof Megaphone;
  color: string;
  suggestedAudience: string;
  suggestedTemplate: string;
  isAutomated: boolean;
}

// ── Built-in patterns ──────────────────────────────────────────────────────

const BUILT_IN_PATTERNS: CampaignPattern[] = [
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Regular updates to your subscriber list",
    category: "engagement",
    icon: Mail,
    color: "from-blue-500 to-cyan-400",
    suggestedAudience: "All contacts",
    suggestedTemplate: "Newsletter",
    isAutomated: false,
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Announce a new product or feature",
    category: "sales",
    icon: Megaphone,
    color: "from-orange-500 to-red-400",
    suggestedAudience: "All contacts",
    suggestedTemplate: "Promotional",
    isAutomated: false,
  },
  {
    id: "welcome-series",
    name: "Welcome Series",
    description: "Automated onboarding for new subscribers",
    category: "onboarding",
    icon: Sparkles,
    color: "from-green-500 to-emerald-400",
    suggestedAudience: "New contacts (segment)",
    suggestedTemplate: "Welcome",
    isAutomated: true,
  },
  {
    id: "re-engagement",
    name: "Re-engagement",
    description: "Win back inactive subscribers",
    category: "retention",
    icon: RefreshCw,
    color: "from-purple-500 to-violet-400",
    suggestedAudience: "Inactive contacts (segment)",
    suggestedTemplate: "Re-engagement",
    isAutomated: false,
  },
  {
    id: "promo-blast",
    name: "Promo Blast",
    description: "Time-limited offer or sale announcement",
    category: "sales",
    icon: Gift,
    color: "from-pink-500 to-rose-400",
    suggestedAudience: "All contacts",
    suggestedTemplate: "Promotional",
    isAutomated: false,
  },
  {
    id: "event-reminder",
    name: "Event Reminder",
    description: "Remind contacts about an upcoming event",
    category: "engagement",
    icon: Bell,
    color: "from-yellow-500 to-amber-400",
    suggestedAudience: "Event segment",
    suggestedTemplate: "Event",
    isAutomated: false,
  },
  {
    id: "drip-campaign",
    name: "Drip Campaign",
    description: "Multi-step automated nurture sequence",
    category: "onboarding",
    icon: Layers,
    color: "from-indigo-500 to-blue-400",
    suggestedAudience: "New leads (segment)",
    suggestedTemplate: "Educational",
    isAutomated: true,
  },
  {
    id: "feedback-request",
    name: "Feedback Request",
    description: "Post-purchase or post-event feedback",
    category: "retention",
    icon: Target,
    color: "from-teal-500 to-cyan-400",
    suggestedAudience: "Recent customers",
    suggestedTemplate: "Feedback",
    isAutomated: true,
  },
];

// ── Category config ────────────────────────────────────────────────────────

const CATEGORIES: { id: CampaignPattern["category"]; label: string; color: string }[] = [
  { id: "engagement", label: "Engagement", color: "text-blue-500" },
  { id: "sales", label: "Sales & Promotions", color: "text-orange-500" },
  { id: "onboarding", label: "Onboarding & Education", color: "text-green-500" },
  { id: "retention", label: "Retention & Loyalty", color: "text-purple-500" },
  { id: "seasonal", label: "Seasonal", color: "text-pink-500" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface CampaignPatternsProps {
  onSelectPattern: (pattern: CampaignPattern) => void;
  onLaunchBlank: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CampaignPatterns({ onSelectPattern, onLaunchBlank }: CampaignPatternsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CampaignPattern["category"] | "all">("all");

  const filteredPatterns = useMemo(() => {
    let patterns = BUILT_IN_PATTERNS;
    if (selectedCategory !== "all") {
      patterns = patterns.filter((p) => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      patterns = patterns.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }
    return patterns;
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* ── Lifecycle Flow Diagram ─────────────────────────────────────── */}
      <div className="bg-bg-secondary/40 border border-border-primary rounded-lg p-4">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers size={13} />
          Campaign Lifecycle
        </h3>
        <div className="flex items-center gap-0">
          {LIFECYCLE_STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center
                    ${idx === 0 ? "bg-accent/20 text-accent" :
                      idx === LIFECYCLE_STEPS.length - 1 ? "bg-green-500/20 text-green-500" :
                      "bg-bg-tertiary text-text-tertiary"}
                  `}
                >
                  <step.icon size={12} />
                </div>
                <span className="text-[0.625rem] text-text-tertiary font-medium truncate max-w-[60px] text-center leading-tight">
                  {step.label}
                </span>
              </div>
              {idx < LIFECYCLE_STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border-secondary mx-1.5 mb-4 relative">
                  <ArrowRight size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-text-tertiary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + Category filters ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search campaign patterns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-primary border border-border-primary rounded-md
              text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-2.5 py-1 text-[0.6875rem] font-medium rounded-full border transition-colors ${
              selectedCategory === "all"
                ? "bg-accent text-white border-accent"
                : "bg-bg-primary text-text-secondary border-border-primary hover:border-accent/40"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-[0.6875rem] font-medium rounded-full border transition-colors ${
                selectedCategory === cat.id
                  ? "bg-accent text-white border-accent"
                  : "bg-bg-primary text-text-secondary border-border-primary hover:border-accent/40"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pattern grid ─────────────────────────────────────────────────── */}
      {filteredPatterns.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-text-tertiary">No patterns match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredPatterns.map((pattern) => (
            <button
              key={pattern.id}
              onClick={() => onSelectPattern(pattern)}
              className="group relative text-left bg-bg-secondary/20 hover:bg-bg-secondary border border-border-primary
                hover:border-accent/40 rounded-lg p-3 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {/* Gradient top accent */}
              <div
                className={`absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-gradient-to-r ${pattern.color} opacity-60`}
              />

              <div className="flex items-start gap-2.5 mt-0.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${pattern.color} bg-opacity-10 shrink-0`}
                >
                  <pattern.icon size={14} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-primary truncate">
                      {pattern.name}
                    </span>
                    {pattern.isAutomated && (
                      <span className="text-[0.5625rem] font-medium text-purple-500 bg-purple-500/10 px-1 py-0.5 rounded">
                        AUTO
                      </span>
                    )}
                  </div>
                  <p className="text-[0.6875rem] text-text-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                    {pattern.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[0.5625rem] text-text-tertiary bg-bg-tertiary/50 px-1 py-0.5 rounded">
                      {pattern.suggestedAudience}
                    </span>
                    <ChevronRight
                      size={11}
                      className="text-text-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Blank campaign ──────────────────────────────────────────────── */}
      <div className="border-t border-border-primary pt-3">
        <button
          onClick={onLaunchBlank}
          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <div className="w-6 h-6 rounded-full border border-dashed border-border-primary flex items-center justify-center">
            <span className="text-text-tertiary text-[0.625rem]">+</span>
          </div>
          Start from scratch
        </button>
      </div>
    </div>
  );
}
