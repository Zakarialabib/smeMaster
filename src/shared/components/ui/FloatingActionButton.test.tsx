import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingActionButton } from './FloatingActionButton';

vi.mock('@/shared/hooks/usePlatform', () => {
  const screenInfo = {
    isMobile: true,
    isDesktop: false,
    category: 'phone' as const,
    aspect: 'portrait' as const,
    width: 375,
    height: 667,
    isFoldable: false,
    hingeOffset: 0,
    visualHeight: 667,
    keyboardOpen: false,
  };
  return {
    usePlatform: () => ({
      mobile: true,
      desktop: false,
      os: 'web',
      arch: 'web',
      is_tablet: false,
      is_phone: true,
      screen: screenInfo,
    }),
  };
});

const mockActions = [
  { id: 'compose', label: 'Compose', icon: <span>✉</span>, onAction: vi.fn() },
  { id: 'upload', label: 'Upload', icon: <span>📎</span>, onAction: vi.fn() },
];

describe('FloatingActionButton', () => {
  it('renders FAB button', () => {
    render(<FloatingActionButton actions={mockActions} />);
    expect(screen.getByLabelText('Open actions')).toBeDefined();
  });

  it('shows actions when toggled open', () => {
    render(<FloatingActionButton actions={mockActions} />);
    fireEvent.click(screen.getByLabelText('Open actions'));
    expect(screen.getByText('Compose')).toBeDefined();
    expect(screen.getByText('Upload')).toBeDefined();
  });

  it('calls onAction when action clicked', () => {
    render(<FloatingActionButton actions={mockActions} />);
    fireEvent.click(screen.getByLabelText('Open actions'));
    fireEvent.click(screen.getByText('Compose'));
    expect(mockActions[0].onAction).toHaveBeenCalled();
  });
});