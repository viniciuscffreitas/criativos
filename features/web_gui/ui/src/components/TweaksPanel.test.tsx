// TweaksPanel — static drawer with disabled toggles, close paths.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TweaksPanel } from './TweaksPanel';

describe('TweaksPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('returns null when open=false', () => {
    const { container } = render(<TweaksPanel open={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Ajustes rápidos" header when open', () => {
    render(<TweaksPanel open onClose={onClose} />);
    expect(screen.getByText('Ajustes rápidos')).toBeInTheDocument();
  });

  it('renders all Geração toggles as disabled', () => {
    render(<TweaksPanel open onClose={onClose} />);
    expect(screen.getByText('Streaming em tempo real')).toBeInTheDocument();
    expect(screen.getByText('Persistir rascunhos')).toBeInTheDocument();
    expect(screen.getByText('Debug trace verboso')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => expect(cb).toBeDisabled());
  });

  it('renders all Aparência toggles as disabled', () => {
    render(<TweaksPanel open onClose={onClose} />);
    expect(screen.getByText('Modo compacto')).toBeInTheDocument();
    expect(screen.getByText('Reduzir animações')).toBeInTheDocument();
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
