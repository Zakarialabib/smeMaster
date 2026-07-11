import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInputModality } from './useInputModality';

describe('useInputModality', () => {
  it('returns a modality string', () => {
    const { result } = renderHook(() => useInputModality());
    expect(['touch', 'mouse', 'keyboard']).toContain(result.current);
  });

  it('sets data-input-modality attribute on html', () => {
    renderHook(() => useInputModality());
    const attr = document.documentElement.getAttribute('data-input-modality');
    expect(['touch', 'mouse', 'keyboard']).toContain(attr);
  });
});