import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import type { FieldDefinition } from './DynamicFieldRenderer';

const fields: FieldDefinition[] = [
  { key: 'name', label: 'Name', type: 'text', value: 'John', required: true },
  { key: 'email', label: 'Email', type: 'email', value: 'john@test.com', section: 'Contact' },
  { key: 'active', label: 'Active', type: 'toggle', value: true, section: 'Status' },
];

describe('DynamicFieldRenderer', () => {
  it('renders all fields', () => {
    render(<DynamicFieldRenderer fields={fields} onChange={vi.fn()} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByDisplayValue('john@test.com')).toBeDefined();
  });

  it('groups fields by section', () => {
    render(<DynamicFieldRenderer fields={fields} onChange={vi.fn()} />);
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Contact')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
  });

  it('calls onChange when input changes', () => {
    const onChange = vi.fn();
    render(<DynamicFieldRenderer fields={fields} onChange={onChange} />);
    const input = screen.getByDisplayValue('John');
    fireEvent.change(input, { target: { value: 'Jane' } });
    expect(onChange).toHaveBeenCalledWith('name', 'Jane');
  });
});