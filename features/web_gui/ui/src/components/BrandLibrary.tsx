// Brand library view — palette, typography specimen, and asset grid.
// Colors derived from src/tokens.ts (mirrors brand/tokens.css).
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { tokens } from '../tokens';
import { IconUpload } from './icons';

interface BrandLibraryProps {
  projectSlug: string;
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; count: number }
  | { kind: 'success'; count: number }
  | { kind: 'error'; message: string };

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
]);
const ACCEPT_ATTR = Array.from(ALLOWED_MIME).join(',');

export function BrandLibrary({ projectSlug }: BrandLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });

  useEffect(() => {
    if (upload.kind !== 'success') return;
    const t = setTimeout(() => setUpload({ kind: 'idle' }), 3000);
    return () => clearTimeout(t);
  }, [upload]);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    for (const f of list) {
      if (!ALLOWED_MIME.has(f.type)) {
        setUpload({ kind: 'error', message: `tipo não suportado: ${f.name} (${f.type || 'desconhecido'})` });
        return;
      }
      if (f.size > MAX_BYTES) {
        setUpload({ kind: 'error', message: `${f.name} excede 10 MB` });
        return;
      }
    }
    setUpload({ kind: 'uploading', count: list.length });
    try {
      await api.uploadAssets(projectSlug, list);
      setUpload({ kind: 'success', count: list.length });
    } catch (err) {
      console.error('[BrandLibrary] uploadAssets failed', err);
      setUpload({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const colors = [
    { name: 'Accent', hex: tokens.accent, role: 'Destaque verde' },
    { name: 'Background', hex: tokens.bg, role: 'Fundo escuro' },
    { name: 'Text', hex: tokens.text, role: 'Texto principal' },
    { name: 'Text Muted', hex: tokens.textMuted, role: 'Texto secundário' },
    { name: 'Border', hex: tokens.border, role: 'Bordas e divisores' },
  ];

  const fonts = [
    { name: 'Geist', role: 'UI e títulos', preview: 'Aa', stack: tokens.fontUI },
    { name: 'Geist Mono', role: 'Técnicos · IDs', preview: 'M0', stack: tokens.fontMono },
    { name: 'Fraunces', role: 'Headlines emocionais', preview: 'Hh', stack: tokens.fontDisplay },
  ];

  const assets = [
    { kind: 'logo', label: 'Logo horizontal', color: '#1c1917' },
    { kind: 'logo', label: 'Logo marca', color: 'var(--accent)' },
    { kind: 'product', label: 'X3 Coral', color: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' },
    { kind: 'product', label: 'X3 Preto', color: 'linear-gradient(135deg, #1c1917, #44403c)' },
    { kind: 'product', label: 'X3 Areia', color: 'linear-gradient(135deg, #fed7aa, #fb923c)' },
    { kind: 'lifestyle', label: 'Urbano · pôr do sol', color: 'linear-gradient(135deg, #fbbf24, #dc2626, #1c1917)' },
    { kind: 'lifestyle', label: 'Asfalto · noite', color: 'linear-gradient(135deg, #292524, #44403c, #78716c)' },
    { kind: 'lifestyle', label: 'Parque · manhã', color: 'linear-gradient(135deg, #bbf7d0, #fef3c7)' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafaf9', overflow: 'auto' }}>
      <div style={{
        height: 56, flexShrink: 0, background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
          Marca
        </h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
        }}>Vibe Web</span>
        <div style={{ flex: 1 }}/>
        <input
          ref={inputRef}
          data-testid="brand-upload-input"
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          style={{ display: 'none' }}
          onChange={(e) => {
            const picked = e.target.files;
            void onPick(picked);
            e.target.value = '';
          }}
        />
        <button
          style={{ ...btnSecondary, opacity: upload.kind === 'uploading' ? 0.6 : 1 }}
          disabled={upload.kind === 'uploading'}
          onClick={() => inputRef.current?.click()}
        >
          <IconUpload size={13}/> Subir ativo
        </button>
      </div>

      {upload.kind === 'uploading' && (
        <div style={{
          padding: '8px 20px', fontSize: 12, color: '#78716c',
          background: '#f5f5f4', borderBottom: '1px solid #e7e5e4',
          fontFamily: '"Geist Mono", monospace',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}/>
          enviando {upload.count} {upload.count === 1 ? 'ativo' : 'ativos'}…
        </div>
      )}
      {upload.kind === 'success' && (
        <div style={{
          padding: '8px 20px', fontSize: 12,
          background: '#dcfce7', color: '#166534',
          borderBottom: '1px solid #bbf7d0',
          fontFamily: '"Geist Mono", monospace',
        }}>
          {upload.count} {upload.count === 1 ? 'ativo enviado' : 'ativos enviados'}
        </div>
      )}
      {upload.kind === 'error' && (
        <div role="alert" style={{
          padding: '8px 20px', fontSize: 12, color: '#dc2626',
          background: 'rgba(220, 38, 38, 0.10)',
          borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
          fontFamily: '"Geist Mono", monospace',
        }}>
          erro no envio: {upload.message}
        </div>
      )}

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Colors */}
        <div>
          <SectionLabel>Paleta</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {colors.map(c => (
              <div key={c.name} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{ height: 80, background: c.hex }}/>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#6f6a64', marginTop: 1,
                    fontFamily: '"Geist Mono", monospace' }}>{c.hex}</div>
                  <div style={{ fontSize: 11, color: '#78716c', marginTop: 4 }}>{c.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fonts */}
        <div>
          <SectionLabel>Tipografia</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {fonts.map(f => (
              <div key={f.name} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, padding: 16,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  fontSize: 40, fontWeight: 600, letterSpacing: -1,
                  color: '#1c1917', lineHeight: 1,
                  fontFamily: f.stack,
                }}>{f.preview}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{f.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assets */}
        <div>
          <SectionLabel>
            Ativos <span style={{ color: '#6f6a64', fontWeight: 400 }}>({assets.length})</span>
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {assets.map((a, i) => (
              <div key={i} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  aspectRatio: '1', background: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.kind === 'logo' && (
                    <div style={{
                      color: a.color === '#1c1917' ? '#fafaf9' : '#fff',
                      fontWeight: 700, fontSize: 18, letterSpacing: -0.5,
                    }}>VIBE WEB</div>
                  )}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#1c1917' }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: '#6f6a64',
                    fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>{a.kind}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
      color: '#78716c', fontWeight: 500, marginBottom: 12,
    }}>{children}</div>
  );
}

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 10px', borderRadius: 6,
  background: '#fff', color: '#44403c', border: '1px solid #e7e5e4',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
