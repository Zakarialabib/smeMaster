import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdaptiveTable } from './AdaptiveTable';

interface TestItem { id: string; name: string; email: string; }
const data: TestItem[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com' },
  { id: '2', name: 'Bob', email: 'bob@test.com' },
];
const columns = [
  { key: 'name', header: 'Name', render: (item: TestItem) => item.name, priority: 1 },
  { key: 'email', header: 'Email', render: (item: TestItem) => item.email, priority: 2 },
];

describe('AdaptiveTable', () => {
  it('renders table headers', () => {
    render(<AdaptiveTable data={data} columns={columns} keyExtractor={(i) => i.id} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
  });

  it('renders all data rows', () => {
    render(<AdaptiveTable data={data} columns={columns} keyExtractor={(i) => i.id} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('calls onRowClick when row clicked', () => {
    const onRowClick = vi.fn();
    render(<AdaptiveTable data={data} columns={columns} keyExtractor={(i) => i.id} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('shows empty state when no data', () => {
    const { container } = render(<AdaptiveTable data={[]} columns={columns} keyExtractor={(i) => i.id} emptyState={<div>Custom empty</div>} />);
    expect(screen.getByText('Custom empty')).toBeDefined();
  });
});