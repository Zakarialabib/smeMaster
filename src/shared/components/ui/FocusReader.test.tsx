import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusReader } from './FocusReader';

describe('FocusReader', () => {
  it('renders children', () => {
    render(<FocusReader onBack={vi.fn()}>Email Content</FocusReader>);
    expect(screen.getByText('Email Content')).toBeDefined();
  });

  it('shows toolbar initially', () => {
    render(<FocusReader onBack={vi.fn()}>Content</FocusReader>);
    expect(screen.getByLabelText('Back')).toBeDefined();
  });

  it('renders action buttons', () => {
    const actions = [{ label: 'Archive', icon: <span>A</span>, onAction: vi.fn() }];
    render(<FocusReader onBack={vi.fn()} actions={actions}>Content</FocusReader>);
    expect(screen.getByText('Archive')).toBeDefined();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<FocusReader onBack={onBack}>Content</FocusReader>);
    fireEvent.click(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalled();
  });
});