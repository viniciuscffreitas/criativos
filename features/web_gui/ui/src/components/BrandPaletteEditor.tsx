// Editable palette section of the BrandLibrary.
//
// Each swatch is click-to-edit via a native HTML color input. Edits live in
// localStorage as a draft (cr_palette_draft) — they do NOT write back to
// brand/tokens.css; that's a separate decision since it ripples through every
// rendered creative.
import React, { useState } from 'react';
import { tokens } from '../tokens';

const PALETTE_DRAFT_KEY = 'cr_palette_draft';

type PaletteKey = 'accent' | 'accentDark' | 'bg' | 'text' | 'textMuted' | 'border';

interface PaletteSwatch {
  key: PaletteKey;
  name: string;
  defaultHex: string;
  role: string;
}

const SWATCHES: PaletteSwatch[] = [
  { key: 'accent',     name: 'Accent',      defaultHex: tokens.accent,     role: 'Destaque verde'   },
  { key: 'accentDark', name: 'Accent Dark', defaultHex: tokens.accentDark, role: 'Hover/pressed'    },
  { key: 'bg',         name: 'Background',  defaultHex: tokens.bg,         role: 'Fundo escuro'     },
  { key: 'text',       name: 'Text',        defaultHex: tokens.text,       role: 'Texto principal'  },
  { key: 'textMuted',  name: 'Text Muted',  defaultHex: tokens.textMuted,  role: 'Texto secundário' },
  { key: 'border',     name: 'Border',      defaultHex: tokens.border,     role: 'Bordas'           },
];

type PaletteDraft = Partial<Record<PaletteKey, string>>;

function readPaletteDraft(): PaletteDraft {
  try {
    const raw = localStorage.getItem(PALETTE_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writePaletteDraft(draft: PaletteDraft): void {
  if (Object.keys(draft).length === 0) {
    localStorage.removeItem(PALETTE_DRAFT_KEY);
  } else {
    localStorage.setItem(PALETTE_DRAFT_KEY, JSON.stringify(draft));
  }
}

interface BrandPaletteEditorProps {
  /** Render slot for the section label so the parent can compose layout. */
  renderLabel?: (label: React.ReactNode) => React.ReactNode;
}

export function BrandPaletteEditor({ renderLabel }: BrandPaletteEditorProps) {
  const [palette, setPalette] = useState<PaletteDraft>(() => readPaletteDraft());
  const hasDraft = Object.keys(palette).length > 0;

  function setSwatch(key: PaletteKey, hex: string): void {
    const next: PaletteDraft = { ...palette, [key]: hex };
    setPalette(next);
    writePaletteDraft(next);
  }

  function resetPalette(): void {
    setPalette({});
    writePaletteDraft({});
  }

  function swatchHex(s: PaletteSwatch): string {
    return palette[s.key] ?? s.defaultHex;
  }

  const labelNode = (
    <>
      Paleta {hasDraft && (
        <span style={{
          marginLeft: 6, padding: '1px 6px', borderRadius: 4,
          background: 'rgba(var(--accent-rgb), 0.10)',
          color: 'var(--accent)',
          fontFamily: '"Geist Mono", monospace', fontSize: 9,
          fontWeight: 500,
          textTransform: 'lowercase', letterSpacing: 0,
        }}>rascunho</span>
      )}
    </>
  );

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        {renderLabel ? renderLabel(labelNode) : (
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
            color: '#78716c', fontWeight: 500,
          }}>{labelNode}</div>
        )}
        {hasDraft && (
          <button
            onClick={resetPalette}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 6,
              background: '#fff', color: '#44403c', border: '1px solid #e7e5e4',
              fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Resetar paleta
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {SWATCHES.map(s => {
          const hex = swatchHex(s);
          const inputId = `swatch-${s.key}`;
          return (
            <label
              key={s.key}
              htmlFor={inputId}
              style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, overflow: 'hidden',
                cursor: 'pointer', display: 'block',
                position: 'relative',
              }}
            >
              <div style={{ height: 80, background: hex }}/>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: '#6f6a64', marginTop: 1,
                  fontFamily: '"Geist Mono", monospace' }}>{hex}</div>
                <div style={{ fontSize: 11, color: '#78716c', marginTop: 4 }}>{s.role}</div>
              </div>
              <input
                id={inputId}
                type="color"
                aria-label={s.name}
                value={hex}
                onInput={(e) => setSwatch(s.key, (e.target as HTMLInputElement).value)}
                onChange={(e) => setSwatch(s.key, (e.target as HTMLInputElement).value)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 1, height: 1,
                  padding: 0, border: 0, opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
