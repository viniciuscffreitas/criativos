import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { describe, it, expect } from 'vitest';

const baseProps = {
  active: 'flow' as const,
  onNav: () => {},
  activeProjectSlug: 'alpha',
  onSelectProject: () => {},
  projects: [
    { slug: 'alpha', name: 'Alpha', description: '', ad_count: 0, variant_count: 0, created_at: '' },
  ],
};

describe('Sidebar', () => {
  it('renders project names from props', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  });

  it('does NOT render the hardcoded "Mateus R." mock-user footer', () => {
    // The Claude-AI-design boilerplate shipped a fake user identity in the
    // sidebar footer. There is no auth/billing system; remove it so users
    // don't see false claims about their plan/credits.
    render(<Sidebar {...baseProps} />);
    expect(screen.queryByText(/Mateus/i)).toBeNull();
    expect(screen.queryByText(/Plano Pro/i)).toBeNull();
    expect(screen.queryByText(/créditos/i)).toBeNull();
  });
});
