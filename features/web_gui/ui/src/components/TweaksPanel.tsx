// TweaksPanel — slide-in drawer with the working settings.
// Currently exposes one wired toggle ("Reduzir animações") backed by
// localStorage + a `data-reduce-motion` attribute on <html> that any
// component can read to disable transitions/animations.
//
// Add new toggles here as backend/UX support lands. Do NOT add disabled
// "coming soon" placeholders — they erode trust.
import { useEffect, useState } from 'react';

interface TweaksPanelProps {
  open: boolean;
  onClose: () => void;
}

const REDUCE_MOTION_KEY = 'cr_reduce_motion';

function readReduceMotion(): boolean {
  return localStorage.getItem(REDUCE_MOTION_KEY) === '1';
}

function writeReduceMotion(on: boolean): void {
  const flag = on ? '1' : '0';
  localStorage.setItem(REDUCE_MOTION_KEY, flag);
  document.documentElement.setAttribute('data-reduce-motion', flag);
}

export function TweaksPanel({ open, onClose }: TweaksPanelProps) {
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => readReduceMotion());

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Sync attribute on first render so other components see the persisted state
  // even if the panel is never opened.
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-reduce-motion', readReduceMotion() ? '1' : '0',
    );
  }, []);

  if (!open) return null;

  function toggleReduceMotion(): void {
    const next = !reduceMotion;
    setReduceMotion(next);
    writeReduceMotion(next);
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 90,
        }}
      />
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: '#78716c',
              letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
            }}>
              Aparência
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={reduceMotion}
                onChange={toggleReduceMotion}
                style={{ flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: '#1c1917', letterSpacing: -0.1 }}>
                Reduzir animações
              </span>
            </label>
            <div style={{
              marginTop: 8, marginLeft: 24, fontSize: 11, color: '#78716c',
              lineHeight: 1.5,
            }}>
              Desativa transições e animações longas. Útil em máquinas mais lentas
              ou se você prefere uma interface mais quieta.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
