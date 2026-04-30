// Polished asset card — hover lift, soft shadow, tooltip with rich
// human-readable description. Replaces the inline AssetCard that used
// to live inside Studio.tsx.
//
// describeAsset() is exported so tests can pin the contextual labels
// without rendering. The text is the bridge between filename + dimensions
// and a description the user actually parses ("Instagram · Post (feed)
// · 1080×1350 vertical" instead of "single-manifesto.png 1080×1350").
import { useState } from 'react';
import type { RenderManifestItem } from '../types';

interface AssetCardRichProps {
  item: RenderManifestItem;
  reloadKey: number;
}

const _CATEGORY_LABEL: Record<string, string> = {
  'brand-logos':    'Logo',
  'brand-social':   'Imagem social',
  'brand-favicons': 'Favicon',
  'meta-ads':       'Meta Ad',
  'instagram':      'Instagram',
};

function _ratioLabel(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return 'quadrado (1:1)';
  if (r > 1.5) return 'horizontal';
  if (r < 0.7) return 'vertical';
  return r > 1 ? 'paisagem' : 'retrato';
}

function _instagramSubcategory(rel: string): string {
  if (rel.startsWith('single-')) return 'Post (feed)';
  if (rel.startsWith('carousel-')) return 'Carrossel';
  if (rel.startsWith('highlight-cover-')) return 'Capa de destaque';
  if (rel.startsWith('story-starter-')) return 'Story';
  if (rel.startsWith('account-avatar')) return 'Avatar';
  return '';
}

export function describeAsset(it: RenderManifestItem): string {
  const base = _CATEGORY_LABEL[it.category] ?? it.category;
  const dim = `${it.width}×${it.height}`;
  const ratio = _ratioLabel(it.width, it.height);
  if (it.category === 'instagram') {
    const sub = _instagramSubcategory(it.relative_path);
    return sub ? `${base} · ${sub} · ${dim} ${ratio}` : `${base} · ${dim} ${ratio}`;
  }
  return `${base} · ${dim} ${ratio}`;
}

export function AssetCardRich({ item, reloadKey }: AssetCardRichProps) {
  const [hover, setHover] = useState(false);
  // Cache-bust the thumbnail when the manifest is refetched after a render —
  // otherwise the browser may keep serving the stale PNG.
  const src = item.exists ? `${item.url}?v=${reloadKey}` : null;
  return (
    <div
      data-testid="asset-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: hover ? '1px solid #d6d3d1' : '1px solid #e7e5e4',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover
          ? '0 8px 24px rgba(28,25,23,0.10)'
          : '0 1px 2px rgba(28,25,23,0.02)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
      }}
    >
      <div style={{
        aspectRatio: `${item.width} / ${item.height}`,
        background: item.exists
          ? '#0a0a0a'
          : 'repeating-linear-gradient(45deg, #fafaf9 0 8px, #f5f5f4 8px 16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {src ? (
          <img
            src={src}
            alt={item.relative_path}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, color: '#78716c',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>pendente</span>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontSize: 11, color: '#1c1917',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.relative_path}</div>
        <div style={{
          fontSize: 10, color: '#6f6a64',
          fontFamily: '"Geist Mono", monospace', marginTop: 1,
        }}>{item.width}×{item.height}</div>
      </div>
      {hover && (
        <div role="tooltip" style={{
          position: 'absolute',
          top: 8, left: 8, right: 8,
          background: 'rgba(28,25,23,0.92)',
          backdropFilter: 'blur(8px)',
          color: '#fafaf9',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: '"Geist Mono", monospace',
          letterSpacing: 0.2,
          pointerEvents: 'none',
        }}>{describeAsset(item)}</div>
      )}
    </div>
  );
}
