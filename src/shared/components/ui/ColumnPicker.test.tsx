import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnPicker } from './ColumnPicker';
import { useColumnConfigStore } from '@shared/stores/columnConfigStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('ColumnPicker', () => {
  beforeEach(() => {
    useColumnConfigStore.getState().resetColumns('email');
    useColumnConfigStore.getState().resetColumns('tasks');
  });

  it('renders a trigger button with an accessible name', () => {
    render(<ColumnPicker configKey="email" />);
    expect(screen.getByRole('button', { name: 'columns.title' })).toBeDefined();
  });

  it('lists every configured column when opened', () => {
    render(<ColumnPicker configKey="email" />);
    fireEvent.click(screen.getByRole('button', { name: 'columns.title' }));

    const menu = screen.getByRole('menu', { name: 'columns.title' });
    expect(menu).toBeDefined();
    // DEFAULT_EMAIL_COLUMNS has 7 entries — labelled ones keep their label,
    // blank ones fall back to the columns.ids.* key.
    expect(screen.getByText('Sender')).toBeDefined();
    expect(screen.getByText('Subject')).toBeDefined();
    expect(screen.getByText('columns.ids.star')).toBeDefined();
    expect(menu.querySelectorAll('input[type="checkbox"]')).toHaveLength(7);
  });

  it("toggles a column's visibility in the store", () => {
    render(<ColumnPicker configKey="email" />);
    fireEvent.click(screen.getByRole('button', { name: 'columns.title' }));

    const star = screen.getByRole('checkbox', {
      name: 'columns.ids.star',
    }) as HTMLInputElement;
    expect(star.checked).toBe(true);

    fireEvent.click(star);

    expect(star.checked).toBe(false);
    const starCol = useColumnConfigStore
      .getState()
      .columnVisibility.email.find((c) => c.id === 'star');
    expect(starCol?.visible).toBe(false);
  });

  it('restores defaults via the reset action', () => {
    render(<ColumnPicker configKey="email" />);
    fireEvent.click(screen.getByRole('button', { name: 'columns.title' }));

    const date = screen.getByRole('checkbox', {
      name: 'Date',
    }) as HTMLInputElement;
    fireEvent.click(date);
    expect(date.checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'columns.reset' }));

    const dateCol = useColumnConfigStore
      .getState()
      .columnVisibility.email.find((c) => c.id === 'date');
    expect(dateCol?.visible).toBe(true);
  });

  it('closes on Escape', () => {
    render(<ColumnPicker configKey="email" />);
    fireEvent.click(screen.getByRole('button', { name: 'columns.title' }));
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('scoped edits do not leak across config keys', () => {
    render(<ColumnPicker configKey="tasks" />);
    fireEvent.click(screen.getByRole('button', { name: 'columns.title' }));

    const actions = screen.getByRole('checkbox', {
      name: 'columns.ids.actions',
    }) as HTMLInputElement;
    fireEvent.click(actions);

    const emailState = useColumnConfigStore.getState().columnVisibility.email;
    const actionsInEmail = emailState.find((c) => c.id === 'actions');
    // "actions" exists only in the tasks defaults — email untouched.
    expect(actionsInEmail).toBeUndefined();
    expect(
      useColumnConfigStore.getState().columnVisibility.tasks.find((c) => c.id === 'actions')
        ?.visible,
    ).toBe(false);
  });
});
