// Brand library view — shell that composes:
//   - <BrandUploadsSection> — user-managed assets (selectable, deletable)
//   - <BrandPaletteEditor>  — click-to-edit color tokens (draft in localStorage)
//   - <BrandTypographyEditor> — click-to-edit fonts (draft in localStorage)
//   - canonical brand assets served by the FastAPI /brand StaticFiles mount
//
// Selection state is unified across uploads + canonical: a single Set<string>
// of selectionIds, where uploads use "upload:<file_id>" and canonical assets
// use "brand:<rel-path>". The bulk-delete toolbar in the header dispatches to
// the appropriate endpoint per selectionId prefix:
//   upload:* → DELETE /api/v1/projects/{slug}/assets/{file_id}
//   brand:*  → DELETE /api/v1/brand-files                       (path body)
//
// Canonical files deleted via the API stay deleted within this session
// (`deletedBrandPaths`) so the card disappears immediately. Refresh restores
// from disk if the file was reincluded by a redeploy.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { IconUpload } from './icons';
import { BrandPaletteEditor } from './BrandPaletteEditor';
import { BrandTypographyEditor } from './BrandTypographyEditor';
import { BrandUploadsSection } from './BrandUploadsSection';

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
  bgClass?: 'dark' | 'light';
}

const BRAND_ASSETS: BrandAsset[] = [
  { src: '/brand/logos/vibeweb-primary.svg',  label: 'Logo principal',     category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-icon.svg',     label: 'Marca (símbolo)',    category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-stacked.svg',  label: 'Logo stacked',       category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-wordmark.svg', label: 'Wordmark',           category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-white.svg',    label: 'Versão branca',      category: 'logo', bgClass: 'dark'  },
  { src: '/brand/logos/vibeweb-black.svg',    label: 'Versão preta',       category: 'logo', bgClass: 'light' },
  { src: '/brand/social/renders/instagram-post.png',  label: 'Instagram post (1080×1080)',  category: 'social' },
  { src: '/brand/social/renders/instagram-story.png', label: 'Instagram story (1080×1920)', category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-portfolio.png', label: 'Highlight · portfolio', category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-services.png',  label: 'Highlight · services',  category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-about.png',     label: 'Highlight · about',     category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-contact.png',   label: 'Highlight · contact',   category: 'social' },
  { src: '/brand/social/renders/instagram-highlight-feed.png',      label: 'Highlight · feed',      category: 'social' },
  { src: '/brand/social/renders/linkedin-banner.png', label: 'LinkedIn banner (1584×396)',  category: 'social' },
  { src: '/brand/social/renders/og-image.png',        label: 'Open Graph (1200×630)',       category: 'social' },
  { src: '/brand/favicons/icon-512.png',         label: 'Favicon 512',  category: 'favicon', bgClass: 'dark' },
  { src: '/brand/favicons/apple-touch-icon.png', label: 'Apple touch',  category: 'favicon', bgClass: 'dark' },
  { src: '/brand/favicons/favicon-32.png',       label: 'Favicon 32',   category: 'favicon', bgClass: 'dark' },
  { src: '/brand/favicons/favicon-16.png',       label: 'Favicon 16',   category: 'favicon', bgClass: 'dark' },
];

export function BrandLibrary({ projectSlug }: BrandLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });

  // Bumps after upload success → BrandUploadsSection refetches.
  const [refetchKey, setRefetchKey] = useState<number>(0);
  // Bumps after a delete that affected uploads → BrandUploadsSection refetches.
  const [externalRefetchKey, setExternalRefetchKey] = useState<number>(0);

  // Unified selection across uploads + canonical (selectionId scheme:
  // "upload:<file_id>" | "brand:<rel-path>").
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Canonical paths the user has deleted this session — hide their cards.
  const [deletedBrandPaths, setDeletedBrandPaths] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggleSelect(selectionId: string): void {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(selectionId)) next.delete(selectionId); else next.add(selectionId);
      return next;
    });
  }

  async function deleteSelected(): Promise<void> {
    if (selected.size === 0) return;
    const count = selected.size;
    const noun = count === 1 ? 'ativo' : 'ativos';
    if (!window.confirm(`Excluir ${count} ${noun}? Não pode ser desfeito.`)) return;

    setDeleteError(null);
    const uploadIds: string[] = [];
    const brandPaths: string[] = [];
    for (const id of selected) {
      if (id.startsWith('upload:')) uploadIds.push(id.slice('upload:'.length));
      else if (id.startsWith('brand:')) brandPaths.push(id.slice('brand:'.length));
    }

    try {
      await Promise.all([
        ...uploadIds.map(fid => api.deleteAsset(projectSlug, fid)),
        ...brandPaths.map(p => api.deleteBrandFile(p)),
      ]);
      // Hide canonical cards we just deleted.
      if (brandPaths.length > 0) {
        setDeletedBrandPaths(prev => {
          const next = new Set(prev);
          for (const p of brandPaths) next.add(p);
          return next;
        });
      }
      // Trigger upload list refetch (server-driven source of truth).
      if (uploadIds.length > 0) setExternalRefetchKey(k => k + 1);
      setSelected(new Set());
    } catch (err) {
      console.error('[BrandLibrary] bulk delete failed', err);
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (upload.kind !== 'success') return;
    setRefetchKey(k => k + 1);
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
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 4 }}>
            <span style={{
              fontFamily: '"Geist Mono", monospace', fontSize: 11, color: '#78716c',
            }}>
              {selected.size} {selected.size === 1 ? 'selecionado' : 'selecionados'}
            </span>
            <button
              onClick={() => void deleteSelected()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6,
                background: '#fff', border: '1px solid rgba(220,38,38,0.3)',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                color: '#dc2626',
              }}
            >
              Excluir
            </button>
          </div>
        )}
        <button
          style={{ ...btnSecondary, opacity: upload.kind === 'uploading' ? 0.6 : 1 }}
          disabled={upload.kind === 'uploading'}
          onClick={() => inputRef.current?.click()}
        >
          <IconUpload size={13}/> Subir ativo
        </button>
      </div>

      {deleteError && (
        <div role="alert" style={{
          padding: '8px 20px', fontSize: 12, color: '#dc2626',
          background: 'rgba(220, 38, 38, 0.10)',
          borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
          fontFamily: '"Geist Mono", monospace',
        }}>
          erro ao excluir: {deleteError}
        </div>
      )}

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
        <BrandUploadsSection
          projectSlug={projectSlug}
          refetchKey={refetchKey}
          externalRefetchKey={externalRefetchKey}
          renderLabel={(label) => <SectionLabel>{label}</SectionLabel>}
          selected={selected}
          onToggle={toggleSelect}
        />

        <BrandPaletteEditor
          renderLabel={(label) => <SectionLabel>{label}</SectionLabel>}
        />

        <BrandTypographyEditor
          renderLabel={(label) => <SectionLabel>{label}</SectionLabel>}
        />

        {/* Canonical brand assets — categories rendered separately */}
        {(['logo', 'social', 'favicon'] as const).map(cat => {
          const items = BRAND_ASSETS.filter(a =>
            a.category === cat && !deletedBrandPaths.has(brandRelPath(a.src)),
          );
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
                {items.map(a => {
                  const relPath = brandRelPath(a.src);
                  const selectionId = `brand:${relPath}`;
                  const isSelected = selected.has(selectionId);
                  return (
                    <BrandAssetCard
                      key={a.src}
                      asset={a}
                      isSelected={isSelected}
                      onToggleSelect={() => toggleSelect(selectionId)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Strip the "/brand/" prefix from a /brand-mounted URL → relative path under brand_dir(). */
function brandRelPath(src: string): string {
  return src.replace(/^\/brand\//, '');
}

interface BrandAssetCardProps {
  asset: BrandAsset;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function BrandAssetCard({ asset, isSelected, onToggleSelect }: BrandAssetCardProps) {
  const bg = asset.bgClass === 'light' ? '#fafaf9'
           : asset.bgClass === 'dark'  ? '#0a0a0a'
           : '#fff';
  const filename = asset.src.split('/').pop() ?? asset.src;
  return (
    <div style={{
      background: '#fff',
      border: isSelected ? '2px solid var(--accent)' : '1px solid #e7e5e4',
      borderRadius: 8, overflow: 'hidden',
      position: 'relative',
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
      <label style={{
        position: 'absolute', top: 6, right: 6,
        width: 22, height: 22, borderRadius: 6,
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid #d6d3d1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          aria-label={`Selecionar ${filename}`}
          checked={isSelected}
          onChange={onToggleSelect}
          style={{ margin: 0, cursor: 'pointer' }}
        />
      </label>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, color: '#1c1917' }}>{asset.label}</div>
        <div style={{ fontSize: 10, color: '#6f6a64',
          fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>
          {filename}
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
