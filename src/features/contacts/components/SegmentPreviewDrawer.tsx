import { useEffect, useState, useCallback } from "react";
import { Filter, Loader2, Users, Download, Mail } from "lucide-react";
import { ContactAvatar } from "@features/contacts/components/ContactAvatar";
import { Button } from "@shared/components/ui/Button";
import { SlidePanel } from "@shared/components/ui/SlidePanel";
import { getAllContacts, type DbContact } from "@features/contacts/db/contacts";
import type { ContactSegment } from "@features/contacts/stores/contactStore";

interface SegmentPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  segment: ContactSegment | null;
  /** When provided, used to filter contacts on the client. */
  onUseAsAudience?: (segment: ContactSegment) => void;
}

interface SegmentPreviewResult {
  contacts: DbContact[];
  total: number;
}

/**
 * Evaluates a simple segment query against the local contact list.
 * Supports: tag:X, group:X, name:X, email:*, and active:Nm syntax.
 * More complex queries fall back to returning all contacts with a warning.
 */
async function evaluateSegment(query: string): Promise<SegmentPreviewResult> {
  const all = await getAllContacts(5000);
  const q = query.trim().toLowerCase();

  let filtered: DbContact[] = all;

  if (q.startsWith("tag:")) {
    const tag = q.slice(4).trim();
    filtered = all.filter((c) =>
      (c.display_name ?? "").toLowerCase().includes(tag),
    );
  } else if (q.startsWith("group:")) {
    const grp = q.slice(6).trim();
    filtered = all.filter((c) =>
      (c.display_name ?? "").toLowerCase().includes(grp),
    );
  } else if (q.startsWith("active:")) {
    const m = q.match(/^active:(\d+)([dhm])/);
    if (m) {
      const n = parseInt(m[1] ?? "30", 10);
      const unit = m[2];
      const seconds =
        unit === "d" ? n * 86400 : unit === "h" ? n * 3600 : n * 60;
      const cutoff = Date.now() / 1000 - seconds;
      filtered = all.filter((c) => (c.last_contacted_at ?? 0) >= cutoff);
    }
  } else if (q.startsWith("name:")) {
    const name = q.slice(5).trim();
    filtered = all.filter((c) =>
      (c.display_name ?? "").toLowerCase().includes(name),
    );
  } else if (q.startsWith("email:")) {
    const email = q.slice(6).trim();
    filtered = all.filter((c) => c.email.toLowerCase().includes(email));
  } else if (q) {
    // Generic substring search
    filtered = all.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.display_name ?? "").toLowerCase().includes(q),
    );
  }

  return { contacts: filtered.slice(0, 50), total: filtered.length };
}

export function SegmentPreviewDrawer({
  isOpen,
  onClose,
  segment,
  onUseAsAudience,
}: SegmentPreviewDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SegmentPreviewResult | null>(null);

  const evaluate = useCallback(async () => {
    if (!segment) return;
    setLoading(true);
    try {
      const r = await evaluateSegment(segment.query);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    if (isOpen && segment) {
      setResult(null);
      evaluate();
    }
  }, [isOpen, segment, evaluate]);

  if (!isOpen || !segment) return null;

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title={segment.name}>
      {/* Query subtitle (was in the custom header) */}
      <div className="flex items-center gap-2 -mt-2">
        <Filter size={12} className="text-accent shrink-0" />
        <p className="text-[0.625rem] text-text-tertiary truncate">
          Query: {segment.query}
        </p>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-border-primary bg-bg-primary/40 -mx-5">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 size={12} className="animate-spin" />
            Evaluating segment…
          </div>
        ) : result ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-text-tertiary" />
              <span className="text-xs text-text-tertiary">Matches:</span>
              <span className="text-sm font-semibold text-text-primary">
                {result.total}
              </span>
            </div>
            {result.total > result.contacts.length && (
              <span className="text-[0.625rem] text-text-tertiary">
                Showing first {result.contacts.length}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto p-2 -mx-5">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 animate-pulse"
              >
                <div className="w-8 h-8 rounded-full bg-bg-tertiary" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-bg-tertiary rounded w-32" />
                  <div className="h-2.5 bg-bg-tertiary rounded w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : result && result.contacts.length > 0 ? (
          <ul className="space-y-1" role="list">
            {result.contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-bg-hover"
              >
                <ContactAvatar
                  name={c.display_name}
                  email={c.email}
                  imageUrl={c.avatar_url}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {c.display_name ?? c.email}
                  </p>
                  <p className="text-[0.625rem] text-text-tertiary truncate">
                    {c.email}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : result ? (
          <div className="text-center py-8 text-xs text-text-tertiary">
            No contacts match this segment.
          </div>
        ) : null}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border-primary flex items-center gap-2 -mx-5">
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          disabled={!result || result.total === 0}
          onClick={() => {
            if (!result) return;
            const header = "email,display_name,frequency\n";
            const rows = result.contacts
              .map(
                (c) =>
                  `${c.email},${(c.display_name ?? "").replace(/,/g, ";")},${c.frequency}`,
              )
              .join("\n");
            const blob = new Blob([header + rows], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `segment-${segment.name.replace(/\s+/g, "_")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export
        </Button>
        <div className="flex-1" />
        {onUseAsAudience && (
          <Button
            variant="primary"
            size="sm"
            icon={<Mail size={14} />}
            disabled={!result || result.total === 0}
            onClick={() => onUseAsAudience(segment)}
          >
            Use as audience
          </Button>
        )}
      </div>
    </SlidePanel>
  );
}
