import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewSwitcher } from './ViewSwitcher';

describe('ViewSwitcher', () => {
  it('renders default views', () => {
    render(<ViewSwitcher activeView="list" onViewChange={vi.fn()} />);
    expect(screen.getByLabelText('List')).toBeDefined();
    expect(screen.getByLabelText('Cards')).toBeDefined();
    expect(screen.getByLabelText('Board')).toBeDefined();
  });

  it('highlights active view', () => {
    render(<ViewSwitcher activeView="card" onViewChange={vi.fn()} />);
    const cardBtn = screen.getByLabelText('Cards');
    expect(cardBtn.className).toContain('bg-white');
  });

  it('calls onViewChange when view clicked', () => {
    const onChange = vi.fn();
    render(<ViewSwitcher activeView="list" onViewChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Board'));
    expect(onChange).toHaveBeenCalledWith('board');
  });

  it('renders only specified available views', () => {
    render(<ViewSwitcher activeView="list" onViewChange={vi.fn()} availableViews={['list', 'calendar']} />);
    expect(screen.getByLabelText('List')).toBeDefined();
    expect(screen.getByLabelText('Calendar')).toBeDefined();
    expect(screen.queryByLabelText('Cards')).toBeNull();
  });
});