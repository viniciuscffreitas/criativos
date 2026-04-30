import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { describe, it, expect, vi, afterEach } from 'vitest';

function setPlatform(platform: string) {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
}

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
    render(<Sidebar {...baseProps} />);
    expect(screen.queryByText(/Mateus/i)).toBeNull();
    expect(screen.queryByText(/Plano Pro/i)).toBeNull();
    expect(screen.queryByText(/créditos/i)).toBeNull();
  });

  it('shows "Projeto único" hint when there is only 1 project', () => {
    // With one project, clicking it is a true no-op (you're already on it).
    // The list still renders for symmetry, but adds a small caption so the
    // user understands the state instead of clicking expecting navigation.
    render(<Sidebar {...baseProps} />);
    expect(screen.getByText(/Projeto único/i)).toBeInTheDocument();
  });

  it('does NOT show the "Projeto único" hint when there are 2+ projects', () => {
    render(<Sidebar {...baseProps} projects={[
      { slug: 'alpha', name: 'Alpha', description: '', ad_count: 0, variant_count: 0, created_at: '' },
      { slug: 'beta',  name: 'Beta',  description: '', ad_count: 0, variant_count: 0, created_at: '' },
    ]} />);
    expect(screen.queryByText(/Projeto único/i)).toBeNull();
  });

  it('clicking the ACTIVE project entry is a no-op (does not call onSelectProject)', () => {
    const onSelectProject = vi.fn();
    render(<Sidebar {...baseProps} onSelectProject={onSelectProject} />);
    // 'Alpha' appears twice — once in the active-project header, once in the
    // project list. The second occurrence is the list row whose click handler
    // we need to exercise.
    const alphaMatches = screen.getAllByText('Alpha');
    fireEvent.click(alphaMatches[alphaMatches.length - 1]);
    expect(onSelectProject).not.toHaveBeenCalled();
  });

  it('clicking an INACTIVE project entry calls onSelectProject', () => {
    const onSelectProject = vi.fn();
    render(<Sidebar {...baseProps} onSelectProject={onSelectProject} projects={[
      { slug: 'alpha', name: 'Alpha', description: '', ad_count: 0, variant_count: 0, created_at: '' },
      { slug: 'beta',  name: 'Beta',  description: '', ad_count: 0, variant_count: 0, created_at: '' },
    ]} />);
    fireEvent.click(screen.getByText('Beta'));
    expect(onSelectProject).toHaveBeenCalledWith('beta');
  });

  describe('platform-aware shortcut hint', () => {
    afterEach(() => { setPlatform(''); });

    it('renders ⌘<n> on Mac', () => {
      setPlatform('MacIntel');
      render(<Sidebar {...baseProps} />);
      expect(screen.getByText('⌘1')).toBeInTheDocument();
      expect(screen.getByText('⌘2')).toBeInTheDocument();
      expect(screen.getByText('⌘3')).toBeInTheDocument();
    });

    it('renders Ctrl+<n> on Windows', () => {
      setPlatform('Win32');
      render(<Sidebar {...baseProps} />);
      expect(screen.getByText('Ctrl+1')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+2')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+3')).toBeInTheDocument();
    });
  });

  it('does NOT render the misleading chevron on the project header', () => {
    // The header rendered a chevron-down suggesting it was a switcher dropdown,
    // but had cursor:default and no handler. Removed; the actual switcher is
    // the "Projetos recentes" list below.
    const { container } = render(<Sidebar {...baseProps} />);
    // No svg should exist on the project header card.
    const switcherCard = container.querySelector('[data-testid="project-switcher"]');
    expect(switcherCard?.querySelector('svg')).toBeNull();
  });
});
