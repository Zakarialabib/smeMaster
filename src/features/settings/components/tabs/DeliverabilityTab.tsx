/**
 * DeliverabilityTab — Consolidated deliverability dashboard.
 *
 * Merges DNS Checker, Blacklist Monitoring, Bounce Management, and
 * Sender Warming into a cohesive hub with internal sub-navigation.
 * Reduces sidebar clutter from 4 separate tabs → 1 tab with sections.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Ban, MailX, Thermometer, BarChart3 } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { DeliverabilityPanel } from "@features/deliverability/components/DeliverabilityPanel";
import { DnsChecker } from "@features/settings/components/DnsChecker";
import { BlacklistChecker } from "@features/settings/components/BlacklistChecker";
import { BounceManager } from "@features/settings/components/BounceManager";
import { WarmingSettings } from "@features/settings/components/WarmingSettings";

// ── Sub-tab definitions ──────────────────────────────────────────────────

interface SubTab {
  id: string;
  label: string;
  icon: typeof Globe;
  description: string;
}

const SUB_TABS: SubTab[] = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    description: "Overall deliverability health and domain status",
  },
  {
    id: "dns",
    label: "DNS Records",
    icon: Globe,
    description: "SPF, DKIM, DMARC verification",
  },
  {
    id: "blacklist",
    label: "Blacklist",
    icon: Ban,
    description: "Blacklist monitoring and reputation",
  },
  {
    id: "bounce",
    label: "Bounces",
    icon: MailX,
    description: "Bounce tracking and suppression",
  },
  {
    id: "warming",
    label: "Warming",
    icon: Thermometer,
    description: "Sender reputation warming",
  },
];

// ── Main Component ──────────────────────────────────────────────────────

export default function DeliverabilityTab() {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* ── Header Stats Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Domains", value: "—", icon: Globe, tone: "accent" as const },
          { label: "Blacklist Status", value: "—", icon: Ban, tone: "success" as const },
          { label: "Bounce Rate", value: "—", icon: MailX, tone: "neutral" as const },
          { label: "Warmup Progress", value: "—", icon: Thermometer, tone: "warning" as const },
        ].map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
              stat.tone === "accent" && "bg-accent/5 border-accent/20",
              stat.tone === "success" && "bg-success/5 border-success/20",
              stat.tone === "neutral" && "bg-bg-tertiary/40 border-border/40",
              stat.tone === "warning" && "bg-warning/5 border-warning/20",
            )}
          >
            <div className="p-2 rounded-lg bg-white/50">
              <stat.icon className={cn("w-4 h-4", stat.tone === "accent" && "text-accent", stat.tone === "success" && "text-success", stat.tone === "warning" && "text-warning", stat.tone === "neutral" && "text-text-tertiary")} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{stat.label}</p>
              <p className="text-sm font-bold truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sub-navigation ─────────────────────────────────────────── */}
      <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-none">
        {SUB_TABS.map((sub) => {
          const Icon = sub.icon;
          const isActive = activeSubTab === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubTab(sub.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 border",
                isActive
                  ? "bg-accent text-white shadow-sm border-accent scale-[1.02]"
                  : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border-border-primary/50",
              )}
            >
              <Icon size={14} />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Active Sub-tab Content ─────────────────────────────────── */}
      {activeSubTab === "overview" && (
        <>
          <SettingGroup
            title={t("settings.tabs.deliverabilityDashboard")}
            description="Monitor domain health, DNS records, blacklist status, bounces, and warming progress from one place."
          >
            <HelpCard
              collapsible
              items={[
                { type: "why", text: "Deliverability is the lifeblood of email marketing. Poor DNS setup, blacklistings, high bounce rates, or cold sending infrastructure all hurt inbox placement." },
                { type: "how", text: "This dashboard consolidates DNS checks, blacklist monitoring, bounce tracking, and warming into a single view. Use the tabs above to drill into each area." },
                { type: "when", text: "Check daily during active campaigns. Review DNS after any domain change. Monitor blacklists and bounces weekly. Run warming for new domains/IPs." },
              ]}
            />
            <div className="mt-4">
              <DeliverabilityPanel />
            </div>
          </SettingGroup>
        </>
      )}

      {activeSubTab === "dns" && (
        <SettingGroup title="DNS Records">
          <HelpCard
            collapsible
            defaultOpen={false}
            items={[
              { type: "why", text: "Proper DNS records (SPF, DKIM, DMARC) are essential for email deliverability — they prove your domain is legitimate and prevent spoofing." },
              { type: "how", text: "The DNS checker queries your domain's public records and validates each record's configuration against best practices." },
              { type: "when", text: "Run when setting up a new domain, after DNS changes, or when emails are being flagged as spam." },
              { type: "tip", text: "DMARC policy should start at 'p=none' for monitoring, then ramp to 'p=quarantine' and finally 'p=reject' once confident in SPF and DKIM." },
            ]}
          />
          <div className="mt-4">
            <DnsChecker />
          </div>
        </SettingGroup>
      )}

      {activeSubTab === "blacklist" && (
        <SettingGroup title="Blacklist Monitoring">
          <HelpCard
            collapsible
            defaultOpen={false}
            items={[
              { type: "why", text: "Blacklists flag domains and IPs known for sending spam. Being listed can severely impact email deliverability to major providers." },
              { type: "how", text: "The checker queries dozens of known DNSBLs and returns your listing status on each. If listed, follow delisting instructions provided." },
              { type: "when", text: "Check periodically or whenever you notice a sudden drop in inbox placement rates." },
              { type: "tip", text: "Set up automated monitoring with alerts. Most blacklists offer grace periods — catching a listing within 24 hours dramatically improves delisting success." },
            ]}
          />
          <div className="mt-4">
            <BlacklistChecker />
          </div>
        </SettingGroup>
      )}

      {activeSubTab === "bounce" && (
        <SettingGroup title="Bounce Management">
          <HelpCard
            collapsible
            defaultOpen={false}
            items={[
              { type: "why", text: "Bounce management helps maintain a clean sender reputation by tracking undelivered emails and identifying problematic recipients." },
              { type: "how", text: "Hard bounces (invalid addresses) are flagged automatically. The manager provides tools to review, categorize, and clean bounce records." },
              { type: "when", text: "Review regularly as part of list hygiene. Address high bounce rates immediately to avoid sender reputation damage." },
              { type: "tip", text: "Keep your overall bounce rate under 2%. Hard bounces above 0.5% can trigger ISP throttling or blacklisting." },
            ]}
          />
          <div className="mt-4">
            <BounceManager />
          </div>
        </SettingGroup>
      )}

      {activeSubTab === "warming" && (
        <SettingGroup title="Sender Warming">
          <HelpCard
            collapsible
            defaultOpen={false}
            items={[
              { type: "why", text: "Email warming gradually builds your sender reputation with ISPs, improving deliverability and reducing spam placement." },
              { type: "how", text: "The warming engine sends controlled, natural-looking email traffic from your domain, gradually increasing volume over days or weeks." },
              { type: "when", text: "Essential for new domains, fresh IP addresses, or after a deliverability crisis. Run for 2-4 weeks for optimal reputation." },
              { type: "tip", text: "Enable auto-pause if bounce rate exceeds 5% or spam complaints exceed 0.1%. Always authenticate with SPF, DKIM, and DMARC first." },
            ]}
          />
          <div className="mt-4">
            <WarmingSettings />
          </div>
        </SettingGroup>
      )}
    </div>
  );
}
