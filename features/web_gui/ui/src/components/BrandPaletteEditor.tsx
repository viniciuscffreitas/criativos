// Editable palette section of the BrandLibrary.
//
// Each swatch is a button that opens a ConfirmDialog with a side-by-side
// preview ("atual" vs "nova") and a color picker. Edits only persist when
// the user explicitly confirms — accidental clicks no longer change the
// palette. Drafts live in localStorage (cr_palette_draft) and do NOT write
// back to brand/tokens.css.
import React, { useState } from 'react';
import { tokens } from '../tokens';
import { ConfirmDialog } from './ConfirmDialog';

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
  const [editing, setEditing] = useState<{ swatch: PaletteSwatch; pending: string } | null>(null);
  const hasDraft = Object.keys(palette).length > 0;

  function swatchHex(s: PaletteSwatch): string {
    return palette[s.key] ?? s.defaultHex;
  }

  function openEditor(s: PaletteSwatch): void {
    setEditing({ swatch: s, pending: swatchHex(s) });
  }

  function commitEditor(): void {
    if (!editing) return;
    const next: PaletteDraft = { ...palette, [editing.swatch.key]: editing.pending };
    setPalette(next);
    writePaletteDraft(next);
  }

  function resetPalette(): void {
    setPalette({});
    writePaletteDraft({});
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
          <button onClick={resetPalette} style={btnSecondaryStyle}>
            Resetar paleta
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {SWATCHES.map(s => (
          <PaletteSwatchButton
            key={s.key}
            swatch={s}
            hex={swatchHex(s)}
            onClick={() => openEditor(s)}
          />
        ))}
      </div>

      {editing && (
        <ConfirmDialog
          open
          title={`Editar ${editing.swatch.name}`}
          confirmLabel="Confirmar"
          onConfirm={commitEditor}
          onClose={() => setEditing(null)}
          body={
            <PaletteEditDialogBody
              swatch={editing.swatch}
              currentHex={swatchHex(editing.swatch)}
              pending={editing.pending}
              onChangePending={(hex) => setEditing(e => e ? { ...e, pending: hex } : e)}
            />
          }
        />
      )}
    </div>
  );
}

function PaletteSwatchButton({
  swatch, hex, onClick,
}: { swatch: PaletteSwatch; hex: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Editar ${swatch.name}`}
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e7e5e4',
        borderRadius: 8, overflow: 'hidden',
        cursor: 'pointer', display: 'block',
        padding: 0, font: 'inherit', textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{ height: 80, background: hex }}/>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{swatch.name}</div>
        <div style={{ fontSize: 10, color: '#6f6a64', marginTop: 1,
          fontFamily: '"Geist Mono", monospace' }}>{hex}</div>
        <div style={{ fontSize: 11, color: '#78716c', marginTop: 4 }}>{swatch.role}</div>
      </div>
    </button>
  );
}

function PaletteEditDialogBody({
  swatch, currentHex, pending, onChangePending,
}: {
  swatch: PaletteSwatch;
  currentHex: string;
  pending: string;
  onChangePending: (hex: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.5 }}>
        Mudando <strong>{swatch.name}</strong> ({swatch.role}). A mudança fica
        salva localmente como rascunho até você confirmar — não afeta os
        criativos já renderizados.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: 70, background: currentHex }}/>
          <div style={{ padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Atual</div>
            <div style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: '#1c1917', marginTop: 2 }}>
              {currentHex}
            </div>
          </div>
        </div>
        <div style={{ background: '#fff', border: '2px solid var(--accent)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: 70, background: pending }}/>
          <div style={{ padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nova</div>
            <div style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: '#1c1917', marginTop: 2 }}>
              {pending}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontSize: 12, color: '#57534e' }}>Nova cor:</label>
        <input
          type="color"
          aria-label="Nova cor"
          value={pending}
          onInput={(e) => onChangePending((e.target as HTMLInputElement).value)}
          onChange={(e) => onChangePending((e.target as HTMLInputElement).value)}
          style={{ width: 48, height: 36, padding: 0, border: '1px solid #e7e5e4', borderRadius: 6, cursor: 'pointer' }}
        />
        <input
          type="text"
          aria-label="Hex da nova cor"
          value={pending}
          onChange={(e) => onChangePending(e.target.value.trim())}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 6,
            border: '1px solid #e7e5e4', fontFamily: '"Geist Mono", monospace',
            fontSize: 12, color: '#1c1917',
          }}
        />
      </div>
    </div>
  );
}

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 8px', borderRadius: 6,
  background: '#fff', color: '#44403c', border: '1px solid #e7e5e4',
  fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
