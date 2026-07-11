import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

interface AppTile {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  badge?: number;
  color: string;
}

const DEFAULT_APPS: AppTile[] = [
  { id: 'mail', label: 'nav.mail', icon: <MailIcon />, route: '/mail/inbox', color: 'bg-blue-500', badge: 12 },
  { id: 'crm', label: 'nav.crm', icon: <UsersIcon />, route: '/people', color: 'bg-emerald-500' },
  { id: 'tasks', label: 'tasks.tasks', icon: <CheckSquareIcon />, route: '/tasks', color: 'bg-amber-500', badge: 3 },
  { id: 'calendar', label: 'calendar.calendar', icon: <CalendarIcon />, route: '/calendar', color: 'bg-violet-500' },
  { id: 'campaigns', label: 'campaign.campaigns', icon: <MegaphoneIcon />, route: '/campaigns', color: 'bg-rose-500' },
  { id: 'settings', label: 'nav.settings', icon: <SettingsIcon />, route: '/settings', color: 'bg-gray-500' },
];

interface AppLauncherProps {
  apps?: AppTile[];
  onAppSelect?: (app: AppTile) => void;
}

export function AppLauncher({ apps = DEFAULT_APPS }: AppLauncherProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const bp = useBreakpoint();
  const cols = bp === 'mobile' ? 'grid-cols-2' : bp === 'tablet' ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6 px-1">SMEMaster</h1>
      <div className={`grid ${cols} gap-4`}>
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => navigate({ to: app.route })}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-accent/30 transition-all active:scale-95 min-h-[100px] relative"
          >
            {app.badge && (
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                {app.badge > 99 ? '99+' : app.badge}
              </span>
            )}
            <div className={`w-12 h-12 rounded-xl ${app.color} flex items-center justify-center text-white`}>
              {app.icon}
            </div>
            <span className="text-sm font-medium">{t(app.label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MailIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>; }
function UsersIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function CheckSquareIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>; }
function CalendarIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function MegaphoneIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>; }
function SettingsIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }

export type { AppTile };