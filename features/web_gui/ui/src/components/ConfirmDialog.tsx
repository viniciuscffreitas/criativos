// Reusable confirmation dialog. Used by the Marca tab for palette swatch
// edits, typography edits, and bulk-delete operations.
//
// Behavior:
//   - Backdrop click + Escape key → onClose only
//   - Enter key + "Confirmar" button → onConfirm then onClose
//   - "Cancelar" button → onClose only
//   - confirmVariant="danger" colors the confirm button red (delete flows)
import React, { useEffect } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open, title, body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  onConfirm, onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
        onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onConfirm, onClose]);

  if (!open) return null;

  const confirmStyle: React.CSSProperties = confirmVariant === 'danger' ? {
    background: '#fff', color: '#dc2626',
    border: '1px solid rgba(220,38,38,0.35)',
  } : {
    background: 'var(--accent)', color: '#0a0a0a',
    border: '1px solid var(--accent)',
  };

  return (
    <>
      <div
        data-testid="confirm-dialog-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 460, maxWidth: 'calc(100vw - 32px)',
            background: '#fff', border: '1px solid #e7e5e4',
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e7e5e4',
            fontSize: 14, fontWeight: 600, color: '#1c1917',
            letterSpacing: -0.1,
          }}>
            {title}
          </div>
          <div style={{ padding: 20 }}>{body}</div>
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #e7e5e4',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            background: '#fafaf9',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 12px', borderRadius: 6,
                background: '#fff', color: '#44403c',
                border: '1px solid #e7e5e4',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              style={{
                padding: '7px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
                ...confirmStyle,
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
