import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormField } from './useFormField';

describe('useFormField', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useFormField({ initialValue: 'test' }));
    expect(result.current.value).toBe('test');
  });

  it('updates value on change', () => {
    const { result } = renderHook(() => useFormField());
    act(() => result.current.onChange('new'));
    expect(result.current.value).toBe('new');
  });

  it('validates on blur', () => {
    const validator = (v: string) => v.length < 3 ? 'Too short' : undefined;
    const { result } = renderHook(() => useFormField({ validator }));
    act(() => result.current.onChange('ab'));
    act(() => result.current.onBlur());
    expect(result.current.error).toBe('Too short');
    expect(result.current.touched).toBe(true);
  });

  it('resets to initial state', () => {
    const { result } = renderHook(() => useFormField({ initialValue: 'test' }));
    act(() => result.current.onChange('changed'));
    act(() => result.current.reset());
    expect(result.current.value).toBe('test');
    expect(result.current.touched).toBe(false);
  });
});