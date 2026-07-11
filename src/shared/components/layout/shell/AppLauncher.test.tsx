import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLauncher } from './AppLauncher';

// Mock useNavigate
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('AppLauncher', () => {
  it('renders all default app tiles', () => {
    render(<AppLauncher />);
    expect(screen.getByText('Mail')).toBeDefined();
    expect(screen.getByText('CRM')).toBeDefined();
    expect(screen.getByText('Tasks')).toBeDefined();
    expect(screen.getByText('Calendar')).toBeDefined();
    expect(screen.getByText('Campaigns')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('shows badge count on Mail tile', () => {
    render(<AppLauncher />);
    expect(screen.getByText('12')).toBeDefined();
  });

  it('shows badge count on Tasks tile', () => {
    render(<AppLauncher />);
    expect(screen.getByText('3')).toBeDefined();
  });
});