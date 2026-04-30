// CommandPalette — search, keyboard nav, wired/unwired commands, close paths.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandPalette } from './CommandPalette';

function setPlatform(platform: string) {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
}

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
    // Default to Mac so the existing assertions ("⌘1", etc.) keep passing.
    setPlatform('MacIntel');
  });
  afterEach(() => { setPlatform(''); });

  it('returns null when open=false', () => {
    const { container } = render(<CommandPalette {...BASE_PROPS} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders only WIRED commands with their keyboard hints', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    // Wired commands stay
    expect(screen.getByText('Ir para Novo fluxo')).toBeInTheDocument();
    expect(screen.getByText('Ir para Galeria')).toBeInTheDocument();
    expect(screen.getByText('Ir para Marca')).toBeInTheDocument();
    expect(screen.getByText('Abrir ajustes rápidos')).toBeInTheDocument();
    expect(screen.getByText('⌘1')).toBeInTheDocument();
    expect(screen.getByText('⌘2')).toBeInTheDocument();
    expect(screen.getByText('⌘3')).toBeInTheDocument();
  });

  it('does NOT render the unwired "coming-in-Spec-X" placeholder commands', () => {
    // Three commands shipped marked wired:false: A/B Test ("Spec 2"),
    // Publicar no Meta ("Spec 4"), Preferências ("Spec 2"). They printed
    // a console.info and closed — no real action. Removed.
    render(<CommandPalette {...BASE_PROPS} />);
    expect(screen.queryByText(/A\/B Test/i)).toBeNull();
    expect(screen.queryByText(/Publicar no Meta/i)).toBeNull();
    expect(screen.queryByText(/^Preferências$/i)).toBeNull();
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

  it('clicking "Abrir ajustes rápidos" calls onOpenTweaks then onClose', () => {
    render(<CommandPalette {...BASE_PROPS} />);
    fireEvent.click(screen.getByText('Abrir ajustes rápidos'));
    expect(BASE_PROPS.onOpenTweaks).toHaveBeenCalledOnce();
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

  describe('platform-aware shortcut hints', () => {
    it('renders Ctrl+<key> hints on Windows', () => {
      setPlatform('Win32');
      render(<CommandPalette {...BASE_PROPS} onOpenTrace={() => {}} />);
      expect(screen.getByText('Ctrl+1')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+2')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+3')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+;')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+L')).toBeInTheDocument();
      // And no leftover Mac glyphs
      expect(screen.queryByText('⌘1')).toBeNull();
      expect(screen.queryByText('⌘L')).toBeNull();
    });

    it('renders ⌘<key> hints on Mac (incl. trace)', () => {
      setPlatform('MacIntel');
      render(<CommandPalette {...BASE_PROPS} onOpenTrace={() => {}} />);
      expect(screen.getByText('⌘1')).toBeInTheDocument();
      expect(screen.getByText('⌘;')).toBeInTheDocument();
      expect(screen.getByText('⌘L')).toBeInTheDocument();
    });
  });
});
