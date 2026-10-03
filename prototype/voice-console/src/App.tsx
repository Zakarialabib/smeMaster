import { useEffect } from 'react';
import { Shell } from './components/Shell';
import { useUiStore, useCallListStore, type Route } from './store';
import { Toast, Panel, PanelHead, Pill } from './components/ui';
import { OpsPage, AlertDetailPage } from './pages/OpsPage';
import { CallsPage } from './pages/CallsPage';
import { LivePage } from './pages/LivePage';
import { ConfigPage } from './pages/ConfigPage';
import { CostPage } from './pages/CostPage';
import { TopologyPage } from './pages/TopologyPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { ScenariosPage } from './pages/ScenariosPage';
import { SettingsPage } from './pages/SettingsPage';

/**
 * Keyboard shortcut → route (UX.md §14). Nothing in this map acts on a live
 * call; the map only switches surface. Escape always returns to Ops because
 * Ops is the "is anything wrong right now?" page, and "get me out of here"
 * almost always means "show me the digest".
 */
const KEY_ROUTES = {
  '1': 'calls',
  '2': 'live',
  '3': 'ops',
  '4': 'config',
  '5': 'knowledge',
  '6': 'cost',
  '7': 'topology',
  '8': 'settings',
  '9': 'scenarios',
} as const satisfies Record<string, Route>;

/** Routes that actually have a page. Anything else renders the placeholder. */
const BUILT_ROUTES = new Set<Route>([
  'calls', 'live', 'ops', 'alerts', 'alert',
  'config', 'knowledge', 'cost', 'topology', 'settings', 'scenarios',
]);

/**
 * Prototype shell — a switch, not a router.
 *
 * The point of this artifact is the screens; pulling @tanstack/react-router
 * into a design prototype would add a dependency for no gain. The real
 * console uses createRoute (src/router/routeTree.tsx) — see FRONTEND.md §12.1.
 */
export function App() {
  const route = useUiStore((s) => s.route);
  const toast = useUiStore((s) => s.toast);
  const notify = useUiStore((s) => s.notify);
  const go = useUiStore((s) => s.go);
  const toggleFlagged = useCallListStore((s) => s.toggleFlagged);

  /* Auto-dismiss the toast. 4200ms is one beat longer than the 4s
     pattern used by macOS notifications, so users stop reaching for close. */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => notify(null), 4200);
    return () => clearTimeout(t);
  }, [toast, notify]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      // Don't hijack keys while the user is typing a key or a phone number.
      if (typing && e.key !== 'Escape') return;

      const nextRoute = KEY_ROUTES[e.key as keyof typeof KEY_ROUTES];
      if (nextRoute) { go(nextRoute); return; }

      if (e.key === 'f') toggleFlagged();
      else if (e.key === '?') notify('1–9 switch surface · f flagged-only · x acknowledge · Esc back · c+d cost grouping');
      else if (e.key === 'Escape') go('ops');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFlagged, notify]);

  const built = BUILT_ROUTES.has(route);

  return (
    <Shell>
      {route === 'calls' && <CallsPage />}
      {route === 'live' && <LivePage />}
      {(route === 'ops' || route === 'alerts') && <OpsPage />}
      {route === 'alert' && <AlertDetailPage />}
      {route === 'config' && <ConfigPage />}
      {route === 'knowledge' && <KnowledgePage />}
      {route === 'cost' && <CostPage />}
      {route === 'topology' && <TopologyPage />}
      {route === 'scenarios' && <ScenariosPage />}
      {route === 'settings' && <SettingsPage />}

      {!built && <UnbuiltRoute route={route} />}
      {toast && <Toast message={toast} onClose={() => notify(null)} />}
    </Shell>
  );
}

/**
 * The second-pass Route union in store.ts names eleven surfaces that have no
 * page yet (`personas`, `shadow`, `wizard`, …). Rendering nothing would look
 * like a bug; rendering an empty panel with the route name is at least honest.
 */
function UnbuiltRoute({ route }: { route: Route }) {
  return (
    <Panel>
      <PanelHead
        title="Not built yet"
        sub={`Route "${route}" is declared in the store but has no page.`}
        right={<Pill tone="off">prototype placeholder</Pill>}
      />
      <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        The Route union in <code>store.ts</code> lists surfaces the brainstorm expects but the
        current prototype does not implement. Press <strong>3</strong> to return to Ops.
      </div>
    </Panel>
  );
}