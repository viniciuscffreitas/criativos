// CommandPalette — search, keyboard nav, wired/unwired commands, close paths.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandPalette } from './CommandPalette';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  onNav: vi.fn(),
  onOpenTweaks: vi.fn(),
  onOpenTrace: null as (() => void) | null,
};

describe('CommandPalette', () => {
  beforeEach(() => {
    BASE_PROPS.onClose.mockClear();
    BASE_PROPS.onNav.mockClear();
    BASE_PROPS.onOpenTweaks.mockClear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('returns null when open=false', () => {
    const { container } = render(<CommandPalette {...BASE_PROPS} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all commands with their keyboard hints', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    expect(screen.getByText('Ir para Novo fluxo')).toBeInTheDocument();
    expect(screen.getByText('Ir para Galeria')).toBeInTheDocument();
    expect(screen.getByText('Ir para Marca')).toBeInTheDocument();
    expect(screen.getByText('A/B Test de variantes')).toBeInTheDocument();
    expect(screen.getByText('Publicar no Meta')).toBeInTheDocument();
    expect(screen.getByText('Preferências')).toBeInTheDocument();
    expect(screen.getByText('⌘1')).toBeInTheDocument();
    expect(screen.getByText('⌘2')).toBeInTheDocument();
    expect(screen.getByText('⌘T')).toBeInTheDocument();
  });

  it('search input filters the list by label substring', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar comando/i), { target: { value: 'Galeria' } });
    expect(screen.getByText('Ir para Galeria')).toBeInTheDocument();
    expect(screen.queryByText('Ir para Novo fluxo')).not.toBeInTheDocument();
  });

  it('wired "Ir para Galeria" calls onNav("gallery") then onClose', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    fireEvent.click(screen.getByText('Ir para Galeria'));
    expect(BASE_PROPS.onNav).toHaveBeenCalledWith('gallery');
    expect(BASE_PROPS.onClose).toHaveBeenCalledOnce();
  });

  it('unwired command calls console.info with spec message then onClose', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    fireEvent.click(screen.getByText('A/B Test de variantes'));
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[CommandPalette]'),
      expect.stringContaining('ab-test'),
    );
    expect(BASE_PROPS.onClose).toHaveBeenCalledOnce();
  });

  it('Escape key closes the palette', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(BASE_PROPS.onClose).toHaveBeenCalledOnce();
  });

  it('ArrowDown + Enter runs the newly-selected command', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    // Default index=0 → "Ir para Novo fluxo". ArrowDown moves to index=1 → "Ir para Galeria".
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(BASE_PROPS.onNav).toHaveBeenCalledWith('gallery');
    expect(BASE_PROPS.onClose).toHaveBeenCalledOnce();
  });

  it('clicking the overlay (outside the card) calls onClose', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    fireEvent.click(screen.getByTestId('palette-overlay'));
    expect(BASE_PROPS.onClose).toHaveBeenCalledOnce();
  });
});
