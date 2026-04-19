// TweaksPanel — static slide-in drawer with disabled toggles (Spec 2 placeholders).
// Inputs: open flag + onClose callback. Outputs: none (read-only in Spec 1).
import { useEffect } from 'react';

interface TweaksPanelProps {
  open: boolean;
  onClose: () => void;
}

const GENERATION_TOGGLES = [
  { id: 'streaming', label: 'Streaming em tempo real' },
  { id: 'persist-drafts', label: 'Persistir rascunhos' },
  { id: 'debug-trace', label: 'Debug trace verboso' },
];

const APPEARANCE_TOGGLES = [
  { id: 'compact', label: 'Modo compacto' },
  { id: 'reduce-motion', label: 'Reduzir animações' },
];

export function TweaksPanel({ open, onClose }: TweaksPanelProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 90,
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 320,
        background: '#fafaf9',
        borderLeft: '1px solid #e7e5e4',
        zIndex: 91,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e7e5e4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
            Ajustes rápidos
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar ajustes"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#78716c', lineHeight: 1,
              padding: '2px 4px', borderRadius: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <TweaksSection title="Geração" toggles={GENERATION_TOGGLES} />
          <TweaksSection title="Aparência" toggles={APPEARANCE_TOGGLES} />
        </div>
      </div>
    </>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

interface Toggle { id: string; label: string; }

function TweaksSection({ title, toggles }: { title: string; toggles: Toggle[] }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#78716c',
        letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toggles.map(t => (
          <label key={t.id} title="Disponível na Spec 2" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            opacity: 0.55, cursor: 'not-allowed',
          }}>
            <input type="checkbox" disabled style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#1c1917', letterSpacing: -0.1 }}>
              {t.label}
            </span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10, color: '#78716c',
              fontFamily: '"Geist Mono", monospace',
            }}>
              Spec 2
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
