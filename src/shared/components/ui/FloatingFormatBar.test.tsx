import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FloatingFormatBar } from './FloatingFormatBar';

const mockActions = [
  { id: 'bold', label: 'Bold', icon: <span>B</span>, onAction: vi.fn() },
  { id: 'italic', label: 'Italic', icon: <span>I</span>, onAction: vi.fn() },
];

function createMockSelection() {
  const rect = { top: 100, left: 50, width: 200, height: 20, bottom: 120, right: 250 } as DOMRect;
  const range = {
    getBoundingClientRect: () => rect,
    collapsed: false,
  } as unknown as Range;
  return {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => range,
    removeAllRanges: () => {},
  } as unknown as Selection;
}

describe('FloatingFormatBar', () => {
  let originalGetSelection: typeof window.getSelection;

  beforeEach(() => {
    originalGetSelection = window.getSelection;
    window.getSelection = vi.fn().mockReturnValue(createMockSelection());
  });

  afterEach(() => {
    window.getSelection = originalGetSelection;
  });

  it('renders action buttons when text is selected', async () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    el.innerText = 'Selectable text';
    document.body.appendChild(el);
    const ref = { current: el };
    render(<FloatingFormatBar actions={mockActions} targetRef={ref} />);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await waitFor(() => {
      expect(screen.getByLabelText('Bold')).toBeDefined();
    });
    expect(screen.getByLabelText('Italic')).toBeDefined();
    document.body.removeChild(el);
  });

  it('renders nothing when there is no selection (position is null)', () => {
    window.getSelection = vi.fn().mockReturnValue(null);
    const ref = { current: document.createElement('div') };
    const { container } = render(<FloatingFormatBar actions={mockActions} targetRef={ref} />);
    // Initially position is null since there's no selection
    expect(container.innerHTML).toBe('');
  });
});