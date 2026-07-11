import { useNavigate } from "@tanstack/react-router";
import { toast } from "@shared/stores/toastStore";
import {
  Mail,
  Users,
  ListChecks,
  BarChart3,
  CalendarDays,
  Settings,
  Sparkles,
} from "lucide-react";

interface FeatureCard {
  id: string;
  icon: typeof Mail;
  label: string;
  description: string;
  path: string;
  color: string;
}

const FEATURES: FeatureCard[] = [
  {
    id: "mail",
    icon: Mail,
    label: "Mail",
    description: "Inbox, send & manage emails",
    path: "/mail/inbox",
    color: "from-blue-500/20 to-blue-600/10",
  },
  {
    id: "crm",
    icon: Users,
    label: "CRM",
    description: "Contacts, tasks & campaigns",
    path: "/people",
    color: "from-emerald-500/20 to-emerald-600/10",
  },
  {
    id: "tasks",
    icon: ListChecks,
    label: "Tasks",
    description: "To-dos & follow-ups",
    path: "/tasks",
    color: "from-amber-500/20 to-amber-600/10",
  },
  {
    id: "campaigns",
    icon: BarChart3,
    label: "Campaigns",
    description: "Email marketing & analytics",
    path: "/campaigns",
    color: "from-rose-500/20 to-rose-600/10",
  },
  {
    id: "calendar",
    icon: CalendarDays,
    label: "Calendar",
    description: "Schedule & events",
    path: "/calendar",
    color: "from-violet-500/20 to-violet-600/10",
  },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
    description: "Account & preferences",
    path: "/settings/mobile",
    color: "from-slate-500/20 to-slate-600/10",
  },
];

export function MobileDashboardPage() {
  const navigate = useNavigate();

  const handleCardPress = (card: FeatureCard) => {
    toast.info(`Opening ${card.label}...`);
    navigate({ to: card.path });
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[28px] font-bold tracking-tight">
            <span className="text-accent">SME</span>Master
          </h1>
          <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider bg-white/10 dark:bg-white/5 px-3 py-1 rounded-full">
            Dashboard
          </span>
        </div>
        <p className="text-sm text-text-tertiary">Your business command center</p>
      </header>

      {/* Feature Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 [-webkit-overflow-scrolling:touch]">
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((card, index) => (
            <button
              key={card.id}
              onClick={() => handleCardPress(card)}
              className={`relative flex flex-col items-start gap-2 p-4 rounded-2xl bg-white/8 dark:bg-white/5 backdrop-blur-[12px] border border-white/15 dark:border-white/8 text-left active:scale-[0.96] transition-all duration-150 ios-tap animate-[cardSpringIn_500ms_cubic-bezier(0.16,1,0.3,1)_both] ios-stagger-${index + 1}`}
            >
              {/* Gradient accent */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.color} opacity-50 pointer-events-none`}
                aria-hidden="true"
              />

              {/* Icon */}
              <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 dark:bg-white/8 backdrop-blur-[8px] border border-white/20 dark:border-white/10">
                <card.icon size={20} className="text-accent" />
              </div>

              {/* Label + description */}
              <div className="relative z-10 mt-auto">
                <span className="text-sm font-semibold text-text-primary block leading-tight">
                  {card.label}
                </span>
                <span className="text-[10px] text-text-tertiary mt-1 block leading-tight">
                  {card.description}
                </span>
              </div>

              {/* Spring indicator */}
              <Sparkles
                size={12}
                className="absolute top-3 right-3 text-accent/30"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
