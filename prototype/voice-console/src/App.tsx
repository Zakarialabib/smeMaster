import { useEffect } from 'react';
import { Shell } from './components/Shell';
import { useUiStore, useCallListStore } from './store';
import { Toast } from './components/ui';
import { OpsPage, AlertDetailPage } from './pages/OpsPage';
import { CallsPage, LivePage } from './pages/CallsPage';
import { ConfigPage, KnowledgePage, CostPage, TopologyPage } from './pages/ConfigPage';

/**
 * Prototype shell. Routing is a switch, not a router: the point of this artifact
 * is the screens, and pulling in @tanstack/react-router would add a dependency to
 * a design prototype for no gain. The real console uses createRoute
 * (src/router/routeTree.tsx) — see FRONTEND.md §12.1.
 */
export function App() {
  const route = useUiStore((s) => s.route);
  const toast = useUiStore((s) => s.toast);
  const notify = useUiStore((s) => s.notify);
  const go = useUiStore((s) => s.go);
  const select = useCallListStore((s) => s.select);
  const toggleFlagged = useCallListStore((s) => s.toggleFlagged);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => notify(null), 4200);
    return () => clearTimeout(t);
  }, [toast, notify]);

  // Keyboard map per UX.md §14. Nothing here acts on a live call.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing && e.key !== 'Escape') return;
      switch (e.key) {
        case '1': go('calls'); break;
        case '2': go('live'); break;
        case '3': go('ops'); break;
        case '4': go('config'); break;
        case '5': go('knowledge'); break;
        case '6': go('cost'); break;
        case '7': go('topology'); break;
        case 'f': toggleFlagged(); break;
        case '?': notify('1–7 switch surface · f flagged-only · x acknowledge · Esc back · c+d cost grouping'); break;
        case 'Escape': go('ops'); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFlagged, notify]);

  return (
    <Shell>
      {route === 'calls' && <CallsPage />}
      {route === 'live' && <LivePage />}
      {route === 'ops' && <OpsPage />}
      {route === 'alert' && <AlertDetailPage />}
      {route === 'config' && <ConfigPage />}
      {route === 'knowledge' && <KnowledgePage />}
      {route === 'cost' && <CostPage />}
      {route === 'topology' && <TopologyPage />}
      {route === 'alerts' && <OpsPage />}
      {toast && <Toast message={toast} onClose={() => notify(null)} />}
      <span style={{ display: 'none' }}>{select.length}</span>
    </Shell>
  );
}
