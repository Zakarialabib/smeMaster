import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTransition } from './PageTransition';

describe('PageTransition', () => {
  it('renders children', () => {
    render(<PageTransition routeKey="home">Hello World</PageTransition>);
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('updates on route key change', () => {
    const { rerender } = render(<PageTransition routeKey="home">Content</PageTransition>);
    rerender(<PageTransition routeKey="settings">Content</PageTransition>);
    expect(screen.getByText('Content')).toBeDefined();
  });
});