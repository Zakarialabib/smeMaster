import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileEditor } from './MobileEditor';

// Mock usePlatform
vi.mock('@/shared/hooks/usePlatform', () => ({
  usePlatform: () => ({ screen: { category: 'phone' } }),
}));

// Mock FloatingFormatBar
vi.mock('@/shared/components/ui/FloatingFormatBar', () => ({
  FloatingFormatBar: ({ actions }: any) => <div data-testid="format-bar">{actions.length} actions</div>,
}));

describe('MobileEditor', () => {
  it('renders children on mobile', () => {
    render(<MobileEditor>Editor Content</MobileEditor>);
    expect(screen.getByText('Editor Content')).toBeDefined();
  });

  it('renders format bar on mobile', () => {
    render(<MobileEditor>Content</MobileEditor>);
    expect(screen.getByTestId('format-bar')).toBeDefined();
  });
});