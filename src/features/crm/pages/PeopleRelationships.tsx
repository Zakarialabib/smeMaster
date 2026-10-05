import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Mail, Tag, MoreHorizontal, Flame } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import {
  AiSuggestionBanner,
  type AiSuggestionItem,
} from '@shared/components/ui/AiSuggestionBanner';
import { DataTable, type DataTableColumn } from '@features/dashboard/components/DataTable';
import { getAllContacts, type DbContact } from '@features/contacts/db/contacts';
import { useComposerStore } from '@features/mail/stores/composerStore';
import { usePagination } from '@shared/hooks/usePagination';
import { formatRelativeDate } from '@shared/utils/date';

type Section = 'people' | 'activity';

const STATUS_STYLES: Record<string, string> = {
  client: 'bg-success/15 text-success',
  supplier: 'bg-info/15 text-info',
  contact: 'bg-accent/15 text-accent',
  other: 'bg-text-tertiary/15 text-text-secondary',
};

function isHot(c: DbContact) {
  return (c.engagement_score ?? 0) >= 70 || c.health_status === 'hot';
}

/**
 * People & Relationships — contact list, hot-lead callout and activity view.
 *
 * Navigation lives in the CRM sidebar (like the mail sidebar): this component
 * renders one `section` with no top tabs or app chrome of its own.
 */
export function PeopleRelationships({ section = 'people' }: { section?: Section }) {
  const navigate = useNavigate();
  const openComposer = useComposerStore((s) => s.openComposer);
  const [aiDismissed, setAiDismissed] = useState(false);

  const {
    items: contacts,
    total: totalContacts,
    loading,
  } = usePagination<DbContact>({
    fetchFn: async ({ limit, offset }) => {
      const [items, total] = await Promise.all([
        getAllContacts(limit, offset),
        import('@features/contacts/db/contacts').then((m) => m.countAllContacts()),
      ]);
      return { items, total };
    },
    pageSize: 50,
  });

  const hotLeads = useMemo(() => contacts.filter(isHot).slice(0, 3), [contacts]);
  const leads = useMemo(() => contacts.filter((c) => c.contact_type === 'contact'), [contacts]);
  const customers = useMemo(() => contacts.filter((c) => c.contact_type === 'client'), [contacts]);

  const ai = useMemo(() => {
    if (section === 'people') {
      const items: AiSuggestionItem[] = hotLeads.map((c) => ({
        id: c.id,
        title: c.display_name || c.email,
        source: c.health_status === 'hot' ? 'buying intent' : `score ${c.engagement_score ?? 0}`,
      }));
      return {
        suggestion: {
          id: 'ai-people',
          title: `AI found ${hotLeads.length} hot lead${hotLeads.length === 1 ? '' : 's'}`,
          description: 'These contacts show buying intent — start a conversation now.',
          count: hotLeads.length,
          type: 'contact' as const,
        },
        items,
        cta: 'Create deals',
      };
    }
    return {
      suggestion: {
        id: 'ai-activity',
        title: 'AI grouped recent activity',
        description: '12 touches across 8 contacts in the last 7 days.',
        count: 12,
        type: 'custom' as const,
      },
      items: [
        { id: 'a1', title: 'Sarah Douiri opened proposal', source: 'email' },
        { id: 'a2', title: 'Youssef Karam replied to quote', source: 'email' },
      ],
      cta: 'View timeline',
    };
  }, [section, hotLeads]);

  // ── Columns (vars: every column is a config object) ──
  const peopleCols: DataTableColumn<DbContact>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (c) => (
        <button
          onClick={() => navigate({ to: '/people/$contactId', params: { contactId: c.id } })}
          className="flex items-center gap-3 text-start hover:text-accent transition-colors"
        >
          <Avatar name={c.display_name || c.email} size="md" />
          <span className="min-w-0">
            <span className="block font-medium text-text-primary truncate">
              {c.display_name || c.email}
            </span>
            <span className="block text-xs text-text-tertiary truncate">{c.email}</span>
          </span>
        </button>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (c) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[c.contact_type] ?? STATUS_STYLES.other}`}
        >
          {c.contact_type}
        </span>
      ),
    },
    {
      id: 'engagement',
      header: 'Engagement',
      cell: (c) =>
        isHot(c) ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ai">
            <Flame size={13} /> Hot
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">{c.frequency} touches</span>
        ),
    },
    {
      id: 'last',
      header: 'Last contact',
      align: 'end',
      cell: (c) => (
        <span className="text-xs text-text-tertiary">
          {c.last_contacted_at ? formatRelativeDate(c.last_contacted_at * 1000) : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '120px',
      align: 'end',
      cell: (c) => (
        <span className="flex items-center justify-end gap-1">
          <button
            onClick={() => openComposer({ to: [c.email], subject: '', mode: 'new' })}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover"
            aria-label="Email"
          >
            <Mail size={15} />
          </button>
          <button
            className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover"
            aria-label="Tag"
          >
            <Tag size={15} />
          </button>
          <button
            className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover"
            aria-label="More"
          >
            <MoreHorizontal size={15} />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary">
      {/* BODY — navigation lives in the CRM sidebar; no top tabs here */}
      <div className="flex-1 overflow-auto p-4">
        {section === 'people' && (
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
              empty={
                loading ? (
                  <div className="text-center text-text-tertiary py-10">Loading…</div>
                ) : (
                  <div className="text-center text-text-tertiary py-10">No contacts yet</div>
                )
              }
            />
          </>
        )}

        {section === 'activity' && (
          <div className="mb-4">
            <AiSuggestionBanner suggestion={ai.suggestion} items={ai.items} variant="info" />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  accent,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? accent
            ? 'bg-ai/15 text-ai border-ai/30'
            : 'bg-accent/10 text-accent border-accent/30'
          : 'bg-bg-secondary text-text-secondary border-border-secondary hover:bg-bg-hover'
      }`}
    >
      {label}
    </button>
  );
}
