// Editable typography section of the BrandLibrary.
//
// Each font card is a button that opens a ConfirmDialog with a live "Aa"
// preview rendered in the typed family + a free-text input + suggestion
// chips. Edits persist as a localStorage draft (cr_typography_draft) keyed
// by role ("display" / "body" / "mono"). DOES NOT write back to
// brand/tokens.css — that change ripples through every rendered creative.
import React, { useState } from 'react';
import { tokens } from '../tokens';
import { ConfirmDialog } from './ConfirmDialog';

const TYPOGRAPHY_DRAFT_KEY = 'cr_typography_draft';

type TypographyKey = 'display' | 'body' | 'mono';

interface FontSlot {
  key: TypographyKey;
  name: string;
  role: string;
  defaultStack: string;
  previewLabel: string;
}

const FONTS: FontSlot[] = [
  { key: 'display', name: 'Display',  role: 'Headlines',           defaultStack: tokens.fontDisplayBrand, previewLabel: 'Aa' },
  { key: 'body',    name: 'Body',     role: 'Texto · UI',          defaultStack: tokens.fontBodyBrand,    previewLabel: 'Aa' },
  { key: 'mono',    name: 'Monoespaçada', role: 'IDs, código',     defaultStack: tokens.fontMonoBrand,    previewLabel: 'M0' },
];

const SUGGESTIONS = ['Syne', 'DM Sans', 'Fira Code', 'Inter', 'Geist', 'Roboto'];

type TypographyDraft = Partial<Record<TypographyKey, string>>;

function readTypographyDraft(): TypographyDraft {
  try {
    const raw = localStorage.getItem(TYPOGRAPHY_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeTypographyDraft(draft: TypographyDraft): void {
  if (Object.keys(draft).length === 0) {
    localStorage.removeItem(TYPOGRAPHY_DRAFT_KEY);
  } else {
    localStorage.setItem(TYPOGRAPHY_DRAFT_KEY, JSON.stringify(draft));
  }
}

interface BrandTypographyEditorProps {
  renderLabel?: (label: React.ReactNode) => React.ReactNode;
}

export function BrandTypographyEditor({ renderLabel }: BrandTypographyEditorProps) {
  const [typography, setTypography] = useState<TypographyDraft>(() => readTypographyDraft());
  const [editing, setEditing] = useState<{ font: FontSlot; pending: string } | null>(null);
  const hasDraft = Object.keys(typography).length > 0;

  function fontStack(f: FontSlot): string {
    const override = typography[f.key];
    return override ? `'${override}', ${f.defaultStack}` : f.defaultStack;
  }

  function fontDisplayName(f: FontSlot): string {
    return typography[f.key] ?? f.defaultStack.replace(/['"]/g, '').split(',')[0].trim();
  }

  function openEditor(f: FontSlot): void {
    setEditing({ font: f, pending: fontDisplayName(f) });
  }

  function commitEditor(): void {
    if (!editing) return;
    const next: TypographyDraft = { ...typography, [editing.font.key]: editing.pending };
    setTypography(next);
    writeTypographyDraft(next);
  }

  function resetTypography(): void {
    setTypography({});
    writeTypographyDraft({});
  }

  const labelNode = (
    <>
      Tipografia da marca {hasDraft && (
        <span style={{
          marginLeft: 6, padding: '1px 6px', borderRadius: 4,
          background: 'rgba(var(--accent-rgb), 0.10)',
          color: 'var(--accent)',
          fontFamily: '"Geist Mono", monospace', fontSize: 9,
          fontWeight: 500, textTransform: 'lowercase', letterSpacing: 0,
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
          <button onClick={resetTypography} style={btnSecondaryStyle}>
            Resetar tipografia
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {FONTS.map(f => (
          <FontSlotButton
            key={f.key}
            font={f}
            stack={fontStack(f)}
            displayName={fontDisplayName(f)}
            onClick={() => openEditor(f)}
          />
        ))}
      </div>

      {editing && (
        <ConfirmDialog
          open
          title={`Editar ${editing.font.name}`}
          confirmLabel="Confirmar"
          onConfirm={commitEditor}
          onClose={() => setEditing(null)}
          body={
            <TypographyEditDialogBody
              font={editing.font}
              pending={editing.pending}
              onChangePending={(name) => setEditing(e => e ? { ...e, pending: name } : e)}
            />
          }
        />
      )}
    </div>
  );
}

function FontSlotButton({
  font, stack, displayName, onClick,
}: { font: FontSlot; stack: string; displayName: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Editar ${font.name}`}
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e7e5e4',
        borderRadius: 8, padding: 16,
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', font: 'inherit', textAlign: 'left',
      }}
    >
      <div style={{
        fontSize: 40, fontWeight: 700, letterSpacing: -1,
        color: '#1c1917', lineHeight: 1,
        fontFamily: stack,
      }}>{font.previewLabel}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{displayName}</div>
        <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{font.role}</div>
      </div>
    </button>
  );
}

function TypographyEditDialogBody({
  font, pending, onChangePending,
}: {
  font: FontSlot;
  pending: string;
  onChangePending: (name: string) => void;
}) {
  const previewStack = pending ? `'${pending}', ${font.defaultStack}` : font.defaultStack;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.5 }}>
        Mudando <strong>{font.name}</strong> ({font.role}). A fonte deve estar
        carregada no app (Google Fonts no <code>index.html</code>) — caso
        contrário cai no fallback do stack.
      </div>
      <div style={{
        background: '#fff', border: '2px solid var(--accent)', borderRadius: 8,
        padding: 24, textAlign: 'center',
      }}>
        <div style={{
          fontFamily: previewStack, fontSize: 64, fontWeight: 700,
          color: '#1c1917', lineHeight: 1, letterSpacing: -1,
        }}>
          {font.previewLabel}
        </div>
        <div style={{
          fontFamily: previewStack, fontSize: 18, fontWeight: 500,
          color: '#57534e', marginTop: 8,
        }}>
          The quick brown fox jumps
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#57534e' }}>Nova fonte</span>
        <input
          type="text"
          aria-label="Nova fonte"
          value={pending}
          onChange={(e) => onChangePending(e.target.value)}
          placeholder="Ex.: Inter, Roboto, Geist…"
          style={{
            padding: '7px 10px', borderRadius: 6,
            border: '1px solid #e7e5e4',
            fontSize: 13, color: '#1c1917',
            fontFamily: 'inherit',
          }}
        />
      </label>
      <div>
        <div style={{
          fontSize: 11, color: '#78716c', textTransform: 'uppercase',
          letterSpacing: 0.5, marginBottom: 6,
        }}>Sugestões</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onChangePending(s)}
              style={{
                padding: '4px 10px', borderRadius: 16,
                background: pending === s ? 'rgba(var(--accent-rgb), 0.10)' : '#fff',
                border: pending === s ? '1px solid var(--accent)' : '1px solid #e7e5e4',
                color: pending === s ? 'var(--accent)' : '#44403c',
                fontSize: 12, fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
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
