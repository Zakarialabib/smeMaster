import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGestureActions } from './useGestureActions';

// Mock useHaptics
vi.mock('./useHaptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

describe('useGestureActions', () => {
  it('returns default mail actions', () => {
    const { result } = renderHook(() => useGestureActions({ context: 'mail' }));
    expect(result.current.actions).toHaveLength(4);
    expect(result.current.actions[0].id).toBe('archive');
  });

  it('returns default tasks actions', () => {
    const { result } = renderHook(() => useGestureActions({ context: 'tasks' }));
    expect(result.current.actions).toHaveLength(3);
    expect(result.current.actions[0].id).toBe('complete');
  });

  it('returns default contacts actions', () => {
    const { result } = renderHook(() => useGestureActions({ context: 'contacts' }));
    expect(result.current.actions).toHaveLength(3);
    expect(result.current.actions[0].id).toBe('call');
  });

  it('finds action by direction', () => {
    const { result } = renderHook(() => useGestureActions({ context: 'mail' }));
    const action = result.current.getActionForDirection('left');
    expect(action?.id).toBe('archive');
  });

  it('returns undefined for unknown direction', () => {
    const { result } = renderHook(() => useGestureActions({ context: 'tasks' }));
    const action = result.current.getActionForDirection('long-right');
    expect(action).toBeUndefined();
  });

  it('merges custom actions overriding defaults by id', () => {
    const custom = [{ id: 'archive', label: 'Custom Archive', icon: null, direction: 'left' as const, onAction: vi.fn() }];
    const { result } = renderHook(() => useGestureActions({ context: 'mail', customActions: custom }));
    expect(result.current.actions[0].label).toBe('Custom Archive');
  });
});