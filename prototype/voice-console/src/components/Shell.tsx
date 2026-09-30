import type { ReactNode } from 'react';
import { Mail, CalendarDays, LayoutDashboard, Users, CheckSquare, Bot, Briefcase, Settings as Gear, Phone, Radio, Activity, SlidersHorizontal, Coins, Database, Network, Cpu, FlaskConical } from 'lucide-react';
import { useUiStore, useUnacknowledgedCount, useReachable, type Route } from '../store';
import { Pill } from './ui';

/** The app's existing grouped rail (navConfig.ts NAV_GROUPS). "Calls" is one group. */
const APP_RAIL = [
  { l: 'Unified', i: LayoutDashboard },
  { l: 'Mail', i: Mail },
  { l: 'Today', i: CheckSquare },
  { l: 'CRM', i: Users },
  { l: 'Tasks', i: CheckSquare },
  { l: 'Calendar', i: CalendarDays },
  { l: 'AI', i: Bot },
  { l: 'Business', i: Briefcase },
];

const CONSOLE_NAV: { r: Route; l: string; i: typeof Phone }[] = [
  { r: 'calls', l: 'Calls', i: Phone },
  { r: 'live', l: 'Live', i: Radio },
  { r: 'ops', l: 'Ops', i: Activity },
  { r: 'config', l: 'Config', i: SlidersHorizontal },
  { r: 'knowledge', l: 'Knowledge', i: Database },
  { r: 'cost', l: 'Cost', i: Coins },
  { r: 'topology', l: 'Topology', i: Network },
  { r: 'scenarios', l: 'Scenarios', i: FlaskConical },
  { r: 'settings', l: 'Settings', i: Cpu },
];

export function Shell({ children }: { children: ReactNode }) {
  const route = useUiStore((s) => s.route);
  const go = useUiStore((s) => s.go);
  const reachable = useReachable();
  const unack = useUnacknowledgedCount();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {/* <nav aria-label="App" className="frost-surface" style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px',
        borderRadius: 'var(--radius-lg)', overflowX: 'auto',
      }}>
        <strong style={{ paddingInlineEnd: 12, whiteSpace: 'nowrap' }}>SMEMaster</strong>
        {APP_RAIL.map(({ l, i: Icon }) => (
          <a key={l} href="#" onClick={(e) => e.preventDefault()}
            className="focus-ring"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              borderRadius: 'var(--radius)', color: 'var(--text-secondary)',
              textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap',
            }}>
            <Icon size={14} />{l}
          </a>
        ))}
        <span style={{ flex: 1 }} />
        <Gear size={15} color="var(--text-tertiary)" />
      </nav> */}

      <nav aria-label="Voice console" className="frost-surface" style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
        borderRadius: 'var(--radius-lg)', flexWrap: 'wrap',
      }}>
        {CONSOLE_NAV.map(({ r, l, i: Icon }) => {
          const on = route === r;
          return (
            <button key={r} onClick={() => go(r)} aria-current={on ? 'page' : undefined} className="focus-ring"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, font: 'inherit', fontSize: 13,
                border: 0, cursor: 'pointer', padding: '7px 12px', borderRadius: 'var(--radius)',
                background: on ? 'var(--accent-subtle)' : 'transparent',
                color: on ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: on ? 600 : 400,
              }}>
              <Icon size={14} />{l}
              {r === 'ops' && unack > 0 && <Pill tone="p1">{unack}</Pill>}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        {reachable ? (
          <Pill tone="ok" title="agent-core answered the last health check">agent-core reachable</Pill>
        ) : (
          <Pill tone="p1" title="Calls are currently unanswered">agent-core OFFLINE</Pill>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingInlineEnd: 8 }}>⟨client⟩ ▾</span>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1240, width: '100%', margin: '0 auto' }}>
        {children}
      </main>

      <footer style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 8 }}>
        High-fidelity <strong>prototype</strong> — design artifact, not product code. Tokens copied from
        <code> src/styles/globals.css</code>. Press <kbd>?</kbd> for shortcuts.
      </footer>
    </div>
  );
}
