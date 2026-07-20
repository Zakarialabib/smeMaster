import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Users, Handshake, Activity, Plus, Search, Mail, Tag,
  MoreHorizontal, Flame,
} from "lucide-react";
import { Avatar } from "@shared/components/ui/Avatar";
import { AiSuggestionBanner, type AiSuggestionItem } from "@shared/components/ui/AiSuggestionBanner";
import { DataTable, type DataTableColumn } from "@features/unified/components/DataTable";
import { getAllContacts, type DbContact } from "@features/contacts/db/contacts";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { usePagination } from "@shared/hooks/usePagination";
import { formatRelativeDate } from "@shared/utils/date";

type Section = "people" | "deals" | "activity";

const SECTIONS: { id: Section; label: string; icon: typeof Users }[] = [
  { id: "people", label: "People", icon: Users },
  { id: "deals", label: "Deals", icon: Handshake },
  { id: "activity", label: "Activity", icon: Activity },
];

const STATUS_STYLES: Record<string, string> = {
  client: "bg-success/15 text-success",
  supplier: "bg-info/15 text-info",
  contact: "bg-accent/15 text-accent",
  other: "bg-text-tertiary/15 text-text-secondary",
};

function isHot(c: DbContact) {
  return (c.engagement_score ?? 0) >= 70 || c.health_status === "hot";
}

/**
 * Unified People & Relationships — a consolidated CRM view that follows the
 * same design system as the Unified Inbox: top navigation (no left sidebar),
 * a per-section AI callout, and the shared var-driven DataTable. Wired to the
 * real contacts data layer.
 */
export function PeopleRelationships() {
  const navigate = useNavigate();
  const openComposer = useComposerStore((s) => s.openComposer);
  const [section, setSection] = useState<Section>("people");
  const [aiDismissed, setAiDismissed] = useState(false);

  const { items: contacts, total: totalContacts, loading } = usePagination<DbContact>({
    fetchFn: async ({ limit, offset }) => {
      const [items, total] = await Promise.all([
        getAllContacts(limit, offset),
        import("@features/contacts/db/contacts").then((m) => m.countAllContacts()),
      ]);
      return { items, total };
    },
    pageSize: 50,
  });

  const hotLeads = useMemo(() => contacts.filter(isHot).slice(0, 3), [contacts]);
  const leads = useMemo(() => contacts.filter((c) => c.contact_type === "contact"), [contacts]);
  const customers = useMemo(() => contacts.filter((c) => c.contact_type === "client"), [contacts]);

  const ai = useMemo(() => {
    if (section === "people") {
      const items: AiSuggestionItem[] = hotLeads.map((c) => ({
        id: c.id,
        title: c.display_name || c.email,
        source: c.health_status === "hot" ? "buying intent" : `score ${c.engagement_score ?? 0}`,
      }));
      return {
        suggestion: { id: "ai-people", title: `AI found ${hotLeads.length} hot lead${hotLeads.length === 1 ? "" : "s"}`, description: "These contacts show buying intent — start a conversation now.", count: hotLeads.length, type: "contact" as const },
        items,
        cta: "Create deals",
      };
    }
    if (section === "deals") {
      return {
        suggestion: { id: "ai-deals", title: "AI summarized your pipeline", description: "3 deals need a follow-up this week to stay on track.", count: 3, type: "custom" as const },
        items: [
          { id: "d1", title: "Best Foods — Q3 proposal", source: "stage: Lead" },
          { id: "d2", title: "Atlas Group — renewal", source: "stage: Lead" },
        ],
        cta: "Open pipeline",
      };
    }
    return {
      suggestion: { id: "ai-activity", title: "AI grouped recent activity", description: "12 touches across 8 contacts in the last 7 days.", count: 12, type: "custom" as const },
      items: [
        { id: "a1", title: "Sarah Douiri opened proposal", source: "email" },
        { id: "a2", title: "Youssef Karam replied to quote", source: "email" },
      ],
      cta: "View timeline",
    };
  }, [section, hotLeads]);

  // ── Columns (vars: every column is a config object) ──
  const peopleCols: DataTableColumn<DbContact>[] = [
    {
      id: "name",
      header: "Name",
      cell: (c) => (
        <button
          onClick={() => navigate({ to: "/people/$contactId", params: { contactId: c.id } })}
          className="flex items-center gap-3 text-start hover:text-accent transition-colors"
        >
          <Avatar name={c.display_name || c.email} size="md" />
          <span className="min-w-0">
            <span className="block font-medium text-text-primary truncate">{c.display_name || c.email}</span>
            <span className="block text-xs text-text-tertiary truncate">{c.email}</span>
          </span>
        </button>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (c) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[c.contact_type] ?? STATUS_STYLES.other}`}>
          {c.contact_type}
        </span>
      ),
    },
    {
      id: "engagement",
      header: "Engagement",
      cell: (c) =>
        isHot(c)
          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-ai"><Flame size={13} /> Hot</span>
          : <span className="text-xs text-text-tertiary">{c.frequency} touches</span>,
    },
    {
      id: "last",
      header: "Last contact",
      align: "end",
      cell: (c) => <span className="text-xs text-text-tertiary">{c.last_contacted_at ? formatRelativeDate(c.last_contacted_at * 1000) : "—"}</span>,
    },
    {
      id: "actions",
      header: "",
      width: "120px",
      align: "end",
      cell: (c) => (
        <span className="flex items-center justify-end gap-1">
          <button onClick={() => openComposer({ to: [c.email], subject: "", mode: "new" })} className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover" aria-label="Email"><Mail size={15} /></button>
          <button className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover" aria-label="Tag"><Tag size={15} /></button>
          <button className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover" aria-label="More"><MoreHorizontal size={15} /></button>
        </span>
      ),
    },
  ];

  return (
    <div className="unified-inbox flex flex-col h-full bg-bg-primary text-text-primary">
      {/* TOP NAVIGATION */}
      <header className="unified-topnav flex items-center gap-2 px-4 py-2.5 border-b border-border-secondary bg-bg-secondary/60 backdrop-blur shrink-0">
        <div className="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center font-bold mr-2">S</div>
        <nav className="flex items-center gap-1" role="tablist" aria-label="CRM sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-hover"}`}
              >
                <Icon size={16} /> {s.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 bg-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-tertiary w-64">
            <Search size={14} /> <span className="truncate">Search contacts, deals…</span>
          </div>
          <button className="flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-accent-hover">
            <Plus size={15} /> New contact
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-4">
        {section === "people" && (
          <>
            {/* filter sub-bar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <FilterChip label={`All ${totalContacts}`} active />
              <FilterChip label={`Leads ${leads.length}`} />
              <FilterChip label={`Customers ${customers.length}`} />
              <FilterChip label={`Hot ${hotLeads.length}`} accent />
            </div>

            {!aiDismissed && (
              <div className="mb-4">
                <AiSuggestionBanner
                  suggestion={ai.suggestion}
                  items={ai.items}
                  onReview={() => setAiDismissed(false)}
                  onDismiss={() => setAiDismissed(true)}
                  variant="info"
                />
              </div>
            )}

            <DataTable
              columns={peopleCols}
              rows={contacts}
              density="comfortable"
              empty={loading ? <div className="text-center text-text-tertiary py-10">Loading…</div> : <div className="text-center text-text-tertiary py-10">No contacts yet</div>}
            />
          </>
        )}

        {section === "deals" && (
          <div className="mb-4">
            <AiSuggestionBanner suggestion={ai.suggestion} items={ai.items} variant="info" />
          </div>
        )}

        {section === "activity" && (
          <div className="mb-4">
            <AiSuggestionBanner suggestion={ai.suggestion} items={ai.items} variant="info" />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, accent }: { label: string; active?: boolean; accent?: boolean }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? accent
            ? "bg-ai/15 text-ai border-ai/30"
            : "bg-accent/10 text-accent border-accent/30"
          : "bg-bg-secondary text-text-secondary border-border-secondary hover:bg-bg-hover"
      }`}
    >
      {label}
    </button>
  );
}
