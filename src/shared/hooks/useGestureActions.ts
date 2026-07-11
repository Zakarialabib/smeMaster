import { useCallback, useMemo } from 'react';
import { useHaptics } from './useHaptics';

export type SwipeDirection = 'left' | 'right' | 'long-left' | 'long-right';

export interface GestureAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  direction: SwipeDirection;
  onAction: () => void;
  destructive?: boolean;
  color?: string;
}

export type GestureContext = 'mail' | 'tasks' | 'contacts';

interface GestureActionConfig {
  context: GestureContext;
  customActions?: GestureAction[];
}

const DEFAULT_ACTION_MAPS: Record<GestureContext, GestureAction[]> = {
  mail: [
    { id: 'archive', label: 'Archive', icon: null, direction: 'left', onAction: () => {}, color: 'bg-blue-500' },
    { id: 'snooze', label: 'Snooze', icon: null, direction: 'right', onAction: () => {}, color: 'bg-amber-500' },
    { id: 'flag', label: 'Flag', icon: null, direction: 'long-right', onAction: () => {}, color: 'bg-orange-500' },
    { id: 'delete', label: 'Delete', icon: null, direction: 'long-left', onAction: () => {}, destructive: true, color: 'bg-red-500' },
  ],
  tasks: [
    { id: 'complete', label: 'Complete', icon: null, direction: 'left', onAction: () => {}, color: 'bg-emerald-500' },
    { id: 'delete', label: 'Delete', icon: null, direction: 'long-left', onAction: () => {}, destructive: true, color: 'bg-red-500' },
    { id: 'schedule', label: 'Schedule', icon: null, direction: 'right', onAction: () => {}, color: 'bg-violet-500' },
  ],
  contacts: [
    { id: 'call', label: 'Call', icon: null, direction: 'left', onAction: () => {}, color: 'bg-green-500' },
    { id: 'email', label: 'Email', icon: null, direction: 'right', onAction: () => {}, color: 'bg-blue-500' },
    { id: 'message', label: 'Message', icon: null, direction: 'long-right', onAction: () => {}, color: 'bg-indigo-500' },
  ],
};

export function useGestureActions({ context, customActions }: GestureActionConfig) {
  const { performHaptic } = useHaptics();

  const actions = useMemo(() => {
    const defaults = DEFAULT_ACTION_MAPS[context] ?? [];
    if (!customActions) return defaults;
    const customMap = new Map(customActions.map(a => [a.id, a]));
    return defaults.map(d => customMap.get(d.id) ?? d);
  }, [context, customActions]);

  const getActionForDirection = useCallback((direction: SwipeDirection): GestureAction | undefined => {
    return actions.find(a => a.direction === direction);
  }, [actions]);

  const executeAction = useCallback((direction: SwipeDirection) => {
    const action = getActionForDirection(direction);
    if (!action) return;
    performHaptic('light');
    action.onAction();
  }, [getActionForDirection, performHaptic]);

  return {
    actions,
    getActionForDirection,
    executeAction,
  } as const;
}