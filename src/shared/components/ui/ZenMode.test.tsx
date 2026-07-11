import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZenMode } from './ZenMode';

describe('ZenMode', () => {
  it('renders children normally when not active', () => {
    render(<ZenMode isActive={false} onExit={vi.fn()}>Content</ZenMode>);
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('renders full-screen when active', () => {
    render(<ZenMode isActive={true} onExit={vi.fn()}>Content</ZenMode>);
    expect(screen.getByLabelText('Exit zen mode')).toBeDefined();
  });

  it('calls onExit when exit button clicked', () => {
    const onExit = vi.fn();
    render(<ZenMode isActive={true} onExit={onExit}>Content</ZenMode>);
    fireEvent.click(screen.getByLabelText('Exit zen mode'));
    expect(onExit).toHaveBeenCalled();
  });

  it('shows Send button when onSend provided', () => {
    render(<ZenMode isActive={true} onExit={vi.fn()} onSend={vi.fn()}>Content</ZenMode>);
    expect(screen.getByText('Send')).toBeDefined();
  });
});