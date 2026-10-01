import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Users } from 'lucide-react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string;
    children?: React.ReactNode;
    className?: string;
    'aria-labelledby'?: string;
    onClick?: (e: { preventDefault: () => void }) => void;
  }) => {
    const { to, children, onClick, ...rest } = props;
    return (
      <a
        href={`#${to}`}
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          navigateSpy(to);
        }}
      >
        {children}
      </a>
    );
  },
}));

import { SectionCard, type SectionStat } from './SectionCard';

const STATS: SectionStat[] = [
  { label: 'dashboard.cards.stat.total', value: 42 },
  { label: 'dashboard.cards.stat.newWeek', value: null },
];

function renderCard(overrides: Partial<Parameters<typeof SectionCard>[0]> = {}) {
  return render(
    <SectionCard
      title="dashboard.sections.people.title"
      icon={Users}
      description="dashboard.sections.people.description"
      to="/people"
      stats={STATS}
      {...overrides}
    />,
  );
}

describe('SectionCard', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it('renders the translated title and stats, with a placeholder for null values', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('New this week')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders as a link to the section route with an accessible name', () => {
    renderCard();
    const link = screen.getByRole('link', { name: 'People' });
    expect(link).toHaveAttribute('href', '#/people');
  });

  it('navigates when the card surface is clicked', () => {
    renderCard();
    fireEvent.click(screen.getByRole('link', { name: 'People' }));
    expect(navigateSpy).toHaveBeenCalledWith('/people');
  });

  it('opens the description slide via the info button WITHOUT navigating', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'About People' }));

    expect(navigateSpy).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'People');
    expect(screen.getByText(/Your contacts and CRM/)).toBeInTheDocument();
    // "Open section" CTA lives in the slide footer
    expect(screen.getAllByRole('link', { name: /Open section/ }).length).toBeGreaterThan(0);
  });

  it('renders the rich content slot (children)', () => {
    renderCard({ children: <p>Extra detail</p> });
    expect(screen.getByText('Extra detail')).toBeInTheDocument();
  });

  it('contains no hardcoded colors in its source', () => {
    // jsdom's import.meta.url is http:// — resolve from the project root instead.
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/dashboard/components/SectionCard.tsx'),
      'utf8',
    );
    // No hex colors (#fff, #0B57D0, …)
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // No raw rgb()/rgba() colors
    expect(source).not.toMatch(/\brgba?\(/);
  });
});
