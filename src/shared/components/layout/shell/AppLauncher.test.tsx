import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLauncher } from './AppLauncher';

// Mock useNavigate (keep the rest of the router module intact — navConfig
// pulls the real route tree through the navigation helper).
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

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
