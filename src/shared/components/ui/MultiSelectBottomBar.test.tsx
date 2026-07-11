import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelectBottomBar } from './MultiSelectBottomBar';

const mockActions = [
  { id: 'tag', label: 'Tag', icon: <span>🏷</span>, onAction: vi.fn() },
  { id: 'delete', label: 'Delete', icon: <span>🗑</span>, onAction: vi.fn(), destructive: true },
];

describe('MultiSelectBottomBar', () => {
  it('shows selected count', () => {
    render(
      <MultiSelectBottomBar
        selectedCount={3}
        actions={mockActions}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.getByText('3 selected')).toBeDefined();
  });

  it('renders nothing when count is 0', () => {
    const { container } = render(
      <MultiSelectBottomBar
        selectedCount={0}
        actions={[]}
        onClearSelection={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders action buttons', () => {
    render(
      <MultiSelectBottomBar
        selectedCount={2}
        actions={mockActions}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.getByText('Tag')).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it('calls onClearSelection when Cancel clicked', () => {
    const onClear = vi.fn();
    render(
      <MultiSelectBottomBar
        selectedCount={2}
        actions={mockActions}
        onClearSelection={onClear}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClear).toHaveBeenCalled();
  });
});