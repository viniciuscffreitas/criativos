import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { describe, it, expect } from 'vitest';

describe('Sidebar', () => {
  it('renders project names from props', () => {
    render(<Sidebar active="flow" onNav={() => {}} activeProjectSlug="alpha"
             onSelectProject={() => {}} projects={[
               { slug: 'alpha', name: 'Alpha', description: '', ad_count: 0, variant_count: 0, created_at: '' }
             ]}/>);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  });
});
