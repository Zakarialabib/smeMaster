import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, PlugZap, RefreshCw } from 'lucide-react';
import { BADGE_BASE, BTN_BASE, BTN_GHOST, CARD_BASE } from '../../../shared/styles/ui-tokens';
import { isError, isLoading, isUnreachable, type LoadState } from '../api/useAgentResource';

/**
 * The console's own primitives, built on the app's real token classes.
 *
 * **Deliberately not copied from the prototype.** The prototype used inline
 * `React.CSSProperties` with hex values, which was fine for a design artefact
 * and is exactly what `BUILD-PLAN.md` §4 forbids in the product. Every class
 * here comes from `ui-tokens.ts`, so a theme change propagates like it does
 * everywhere else in the app.
 *
 * The four state components are the substance of this file. The prototype could
 * render one state because it had fixtures; the product has to render four, and
 * getting them confused is how a user ends up staring at an empty table that is
 * really a dead server.
 */

export function AgentCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD_BASE} ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-text-primary">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * The four states, as four components.
 *
 * `render` receives a ready state only, so a screen cannot accidentally read
 * data that has not arrived — TypeScript makes reading from `loading` an error
 * rather than an `undefined` at runtime.
 */
export function AgentResource<T>({
  state,
  onRetry,
  empty,
  isEmpty,
  children,
}: {
  state: LoadState<T>;
  onRetry?: () => void;
  /** Rendered when the data arrived and is genuinely empty. */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (isLoading(state)) return <AgentSkeleton />;

  if (isUnreachable(state)) {
    return (
      <AgentNotice
        tone="danger"
        icon={<PlugZap size={16} aria-hidden />}
        title="Cannot reach the agent"
        // The distinction that matters: the server is not answering. Telling
        // this user to "try again" when the VPS is down teaches them that the
        // button does nothing.
        body={state.message}
        action={
          onRetry ? (
            <button type="button" className={`${BTN_BASE} ${BTN_GHOST}`} onClick={onRetry}>
              <RefreshCw size={14} aria-hidden /> Retry
            </button>
          ) : undefined
        }
      />
    );
  }

  if (isError(state)) {
    return (
      <AgentNotice
        tone="danger"
        icon={<AlertTriangle size={16} aria-hidden />}
        title="The request failed"
        body={state.message}
        action={
          state.retryable && onRetry ? (
            <button type="button" className={`${BTN_BASE} ${BTN_GHOST}`} onClick={onRetry}>
              <RefreshCw size={14} aria-hidden /> Retry
            </button>
          ) : undefined
        }
      />
    );
  }

  // `state` is narrowed to `ready` by the guards above.
  if (isEmpty?.(state.data)) return <>{empty ?? <AgentEmpty />}</>;
  return <>{children(state.data)}</>;
}

/** Skeleton, not a spinner. A spinner says "wait"; a skeleton says "this is a table". */
export function AgentSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-md bg-bg-hover"
          // Staggered so the block reads as one loading region rather than a
          // stack of unrelated bars.
          style={{ animationDelay: `${i * 80}ms`, opacity: 1 - i * 0.18 }}
        />
      ))}
      <span className="sr-only">
        <Loader2 size={0} aria-hidden /> Loading…
      </span>
    </div>
  );
}

export function AgentEmpty({ label = 'Nothing here yet' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-text-tertiary">
      <Inbox size={20} aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function AgentNotice({
  tone = 'info',
  icon,
  title,
  body,
  action,
}: {
  tone?: 'info' | 'danger' | 'warning';
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-danger/30 bg-danger/5'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning/5'
        : 'border-border-primary bg-bg-secondary';
  return (
    <div className={`rounded-[--radius] border p-4 ${toneClass}`} role="alert">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-text-secondary">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          {body && <p className="mt-1 text-sm text-text-secondary break-words">{body}</p>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function AgentBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'ai' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  const toneClass = {
    neutral: 'bg-bg-hover text-text-secondary',
    accent: 'bg-accent/15 text-accent',
    // AI = INFERRED. A summary, a judgement, a containment verdict. Never a
    // transcript, which is a fact.
    ai: 'bg-ai/15 text-ai',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
  }[tone];
  return <span className={`${BADGE_BASE} ${toneClass}`}>{children}</span>;
}
