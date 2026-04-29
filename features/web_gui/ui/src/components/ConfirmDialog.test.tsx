import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onConfirm.mockClear();
  });

  it('returns null when open=false', () => {
    const { container } = render(
      <ConfirmDialog open={false} onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title + body when open', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="Editar accent" body={<div>preview</div>} />
    );
    expect(screen.getByText('Editar accent')).toBeInTheDocument();
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('Confirm button fires onConfirm + onClose', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Cancel button fires onClose only', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape key fires onClose only', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Enter key fires onConfirm + onClose', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} />
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('backdrop click fires onClose only', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} />
    );
    fireEvent.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses custom confirmLabel when provided', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} confirmLabel="Excluir 3" />
    );
    expect(screen.getByRole('button', { name: /Excluir 3/i })).toBeInTheDocument();
  });

  it('danger variant styles confirm button differently', () => {
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm}
                     title="X" body={<div/>} confirmVariant="danger" />
    );
    const btn = screen.getByRole('button', { name: /Confirmar/i });
    // The danger variant uses red text
    expect(getComputedStyle(btn).color).toMatch(/220.*38.*38|rgb\(220, 38, 38\)|#dc2626/i);
  });
});
