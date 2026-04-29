// TweaksPanel — single working toggle (reduce-motion) + close paths.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TweaksPanel } from './TweaksPanel';

describe('TweaksPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-reduce-motion');
  });

  it('returns null when open=false', () => {
    const { container } = render(<TweaksPanel open={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Ajustes rápidos" header when open', () => {
    render(<TweaksPanel open onClose={onClose} />);
    expect(screen.getByText('Ajustes rápidos')).toBeInTheDocument();
  });

  it('does NOT render the Spec-2 placeholder toggles', () => {
    // Boilerplate left 5 disabled placeholder toggles ("Streaming em tempo real",
    // "Persistir rascunhos", "Debug trace verboso", "Modo compacto", and a
    // disabled "Spec 2" badge per row) — none of them did anything. Removed.
    render(<TweaksPanel open onClose={onClose} />);
    expect(screen.queryByText(/Streaming em tempo real/i)).toBeNull();
    expect(screen.queryByText(/Persistir rascunhos/i)).toBeNull();
    expect(screen.queryByText(/Debug trace verboso/i)).toBeNull();
    expect(screen.queryByText(/Modo compacto/i)).toBeNull();
    expect(screen.queryByText(/^Spec 2$/i)).toBeNull();
  });

  it('renders the working "Reduzir animações" toggle', () => {
    render(<TweaksPanel open onClose={onClose} />);
    const toggle = screen.getByLabelText(/Reduzir animações/i) as HTMLInputElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeDisabled();
  });

  it('reads initial reduce-motion state from localStorage', () => {
    localStorage.setItem('cr_reduce_motion', '1');
    render(<TweaksPanel open onClose={onClose} />);
    const toggle = screen.getByLabelText(/Reduzir animações/i) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('toggling reduce-motion persists to localStorage and applies attribute', () => {
    render(<TweaksPanel open onClose={onClose} />);
    const toggle = screen.getByLabelText(/Reduzir animações/i) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    expect(localStorage.getItem('cr_reduce_motion')).toBe('1');
    expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('1');

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(localStorage.getItem('cr_reduce_motion')).toBe('0');
    expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('0');
  });

  it('close × button calls onClose', () => {
    render(<TweaksPanel open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /fechar ajustes/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape key calls onClose', () => {
    render(<TweaksPanel open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
