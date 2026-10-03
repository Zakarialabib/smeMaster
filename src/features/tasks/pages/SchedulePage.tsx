import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { CheckSquare, Calendar } from 'lucide-react';
import { CardTabBar, type CardTabItem } from '@shared/components/ui/CardTabBar';
import { TasksPage } from '@features/tasks/components/TasksPage';
import { CalendarPage } from '@features/calendar/components/CalendarPage';

type ScheduleTab = 'tasks' | 'calendar';

/**
 * Schedule — Tasks + Calendar.
 *
 * Both share account-scoped context behind a single nav item with an
 * in-page card-tab strip (shared CardTabBar wireframe). The active tab is
 * URL-synced (`?tab=calendar`) so refresh, deep links and the rail flyout
 * all agree on what is on screen.
 */
export function SchedulePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const param = new URLSearchParams(location.searchStr).get('tab');
  const tab: ScheduleTab = param === 'calendar' ? 'calendar' : 'tasks';

  const tabs: CardTabItem<ScheduleTab>[] = [
    { id: 'tasks', label: t('common.tasks'), icon: CheckSquare },
    { id: 'calendar', label: t('common.calendar'), icon: Calendar },
  ];

  const handleTabChange = (next: ScheduleTab) => {
    if (next === tab) return;
    navigate({ to: '/tasks', search: (prev) => ({ ...prev, tab: next }) });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Card-tab strip */}
      <div className="py-2 px-3 sm:px-6 shrink-0">
        <CardTabBar
          tabs={tabs}
          activeTab={tab}
          onTabChange={handleTabChange}
          ariaLabel={t('common.schedule')}
        />
      </div>

      {/* Active section */}
      <div id={`tabpanel-${tab}`} role="tabpanel" className="flex-1 overflow-y-auto flex flex-col">
        {tab === 'tasks' ? <TasksPage /> : <CalendarPage />}
      </div>
    </div>
  );
}
