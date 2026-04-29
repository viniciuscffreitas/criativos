// Brand library view — palette, typography specimen, and the actual brand
// assets served by the FastAPI /brand StaticFiles mount (brand/ on disk).
//
// IMPORTANT: This view shows the TRUE brand — not mock placeholders. Logos
// come from /brand/logos/, social renders from /brand/social/renders/,
// favicons from /brand/favicons/. Fonts shown match the brand fonts in
// brand/tokens.css (Syne, DM Sans, Fira Code) — not the webapp's chrome
// typography (Geist/Fraunces).
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

interface BrandAsset {
  src: string;
  label: string;
  category: 'logo' | 'social' | 'favicon';
  // Background hint so transparent SVGs render readable on light/dark.
  bgClass?: 'dark' | 'light';
}

// Hard-coded list of the brand assets that ship with the repo. Each entry
// points at a real file under /brand (mounted by features/web_gui/server.py).
// If you add a new file under brand/, add it here too — there is no API
// endpoint to enumerate the directory and we keep this explicit so the
// layout doesn't shift on every disk scan.
const BRAND_ASSETS: BrandAsset[] = [
  // Logos (SVG primary; PNG also exists for non-vector consumers)
  { src: '/brand/logos/vibeweb-primary.svg',  label: 'Logo principal',     category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-icon.svg',     label: 'Marca (símbolo)',    category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-stacked.svg',  label: 'Logo stacked',       category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-wordmark.svg', label: 'Wordmark',           category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-white.svg',    label: 'Versão branca',      category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-black.svg',    label: 'Versão preta',       category: 'logo', bgClass: 'light' },

  // Social renders
  { src: '/brand/social/renders/instagram-post.png',  label: 'Instagram post (1080×1080)',  category: 'social' },
  { src: '/brand/social/renders/instagram-story.png', label: 'Instagram story (1080×1920)', category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-portfolio.png', label: 'Highlight · portfolio', category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-services.png',  label: 'Highlight · services',  category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-about.png',     label: 'Highlight · about',     category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-contact.png',   label: 'Highlight · contact',   category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-feed.png',      label: 'Highlight · feed',      category: 'social' },
  { src: '/brand/social/renders/linkedin-banner.png', label: 'LinkedIn banner (1584×396)',  category: 'social' },
  { src: '/brand/social/renders/og-image.png',        label: 'Open Graph (1200×630)',       category: 'social' },

  // Favicons
  { src: '/brand/favicons/icon-512.png',        label: 'Favicon 512',  category: 'favicon', bgClass: 'dark' },
  { src: '/brand/favicons/apple-touch-icon.png', label: 'Apple touch', category: 'favicon', bgClass: 'dark' },
  { src: '/brand/favicons/favicon-32.png',      label: 'Favicon 32',   category: 'favicon', bgClass: 'dark' },
  { src: '/brand/favicons/favicon-16.png',      label: 'Favicon 16',   category: 'favicon', bgClass: 'dark' },
];

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
    { name: 'Accent Dark', hex: tokens.accentDark, role: 'Hover/pressed' },
    { name: 'Background', hex: tokens.bg, role: 'Fundo escuro' },
    { name: 'Text', hex: tokens.text, role: 'Texto principal' },
    { name: 'Text Muted', hex: tokens.textMuted, role: 'Texto secundário' },
    { name: 'Border', hex: tokens.border, role: 'Bordas e divisores' },
  ];

  // BRAND fonts — match brand/tokens.css and what the rendered creatives use.
  const fonts = [
    { name: 'Syne',      role: 'Display · headlines',  preview: 'Aa', stack: tokens.fontDisplayBrand },
    { name: 'DM Sans',   role: 'Body · UI',            preview: 'Aa', stack: tokens.fontBodyBrand    },
    { name: 'Fira Code', role: 'Mono · IDs / código',  preview: 'M0', stack: tokens.fontMonoBrand    },
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
        }}>{projectSlug}</span>
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
          <SectionLabel>Tipografia da marca</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {fonts.map(f => (
              <div key={f.name} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, padding: 16,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  fontSize: 40, fontWeight: 700, letterSpacing: -1,
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

        {/* Assets — categories rendered separately */}
        {(['logo', 'social', 'favicon'] as const).map(cat => {
          const items = BRAND_ASSETS.filter(a => a.category === cat);
          if (items.length === 0) return null;
          const titles: Record<typeof cat, string> = {
            logo: 'Logos',
            social: 'Social',
            favicon: 'Favicons',
          };
          return (
            <div key={cat}>
              <SectionLabel>
                {titles[cat]} <span style={{ color: '#6f6a64', fontWeight: 400 }}>({items.length})</span>
              </SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {items.map(a => (
                  <BrandAssetCard key={a.src} asset={a} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandAssetCard({ asset }: { asset: BrandAsset }) {
  const bg = asset.bgClass === 'light' ? '#fafaf9'
           : asset.bgClass === 'dark'  ? '#0a0a0a'
           : '#fff';
  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e5e4',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{
        aspectRatio: '1', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, overflow: 'hidden',
      }}>
        <img
          src={asset.src}
          alt={asset.label}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, color: '#1c1917' }}>{asset.label}</div>
        <div style={{ fontSize: 10, color: '#6f6a64',
          fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>
          {asset.src.split('/').pop()}
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
