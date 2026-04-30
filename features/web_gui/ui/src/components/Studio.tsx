// Studio view — the "ops center" UI for the asset pipeline.
//
// Composition: header (title + slug pill) + three sections (Marca, Meta Ads,
// Instagram). Each section shows a "X/Y rendered" counter, a "Gerar [cat]"
// button that triggers the corresponding /render/* endpoint, and a grid of
// asset cards. Cards are either a thumbnail (exists=true) or a hatched
// "pendente" placeholder (exists=false) — the same pattern BrandLibrary uses
// for canonical brand assets.
//
// Manifest is fetched on mount and refetched after every successful render
// so cards flip from "pendente" to thumbnail without a page reload. Errors
// surface as a §2.7 alert banner — never a silent fallback.
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { RenderManifest, RenderManifestItem } from '../types';

interface StudioProps {
  projectSlug: string;
}

type GenerateState =
  | { kind: 'idle' }
  | { kind: 'running'; action: 'brand' | 'ads' | 'instagram' }
  | { kind: 'error'; message: string };

interface Section {
  key: 'brand' | 'meta-ads' | 'instagram';
  label: string;
  buttonLabel: string;
  categories: string[];
  action: 'brand' | 'ads' | 'instagram';
}

const SECTIONS: Section[] = [
  { key: 'brand',     label: 'Marca',     buttonLabel: 'Gerar marca',     categories: ['brand-logos', 'brand-social', 'brand-favicons'], action: 'brand' },
  { key: 'meta-ads',  label: 'Meta Ads',  buttonLabel: 'Gerar ads',       categories: ['meta-ads'],                                       action: 'ads' },
  { key: 'instagram', label: 'Instagram', buttonLabel: 'Gerar instagram', categories: ['instagram'],                                      action: 'instagram' },
];

export function Studio({ projectSlug }: StudioProps) {
  const [manifest, setManifest] = useState<RenderManifest | null>(null);
  const [state, setState] = useState<GenerateState>({ kind: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.getRenderManifest()
      .then(setManifest)
      .catch((e: Error) => {
        console.error('[Studio] getRenderManifest failed', e);
        setState({ kind: 'error', message: e.message });
      });
  }, [reloadKey]);

  async function generate(action: 'brand' | 'ads' | 'instagram'): Promise<void> {
    setState({ kind: 'running', action });
    try {
      if (action === 'brand') await api.renderBrand();
      else if (action === 'ads') await api.renderAds(undefined);
      else await api.renderInstagram(undefined);
      setReloadKey(k => k + 1);
      setState({ kind: 'idle' });
    } catch (err) {
      console.error('[Studio] render failed', err);
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div data-testid="studio-view" style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#fafaf9', overflow: 'auto', minWidth: 0,
    }}>
      <header style={{
        height: 56, flexShrink: 0, background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
          Studio
        </h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
        }}>{projectSlug}</span>
      </header>

      {state.kind === 'error' && (
        <div role="alert" style={{
          padding: '8px 20px', fontSize: 12, color: '#dc2626',
          background: 'rgba(220, 38, 38, 0.10)',
          borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
          fontFamily: '"Geist Mono", monospace',
        }}>erro: {state.message}</div>
      )}

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
        {SECTIONS.map(sec => {
          const items: RenderManifestItem[] = sec.categories.flatMap(c => manifest?.categories[c] ?? []);
          const okCount = items.filter(it => it.exists).length;
          const running = state.kind === 'running' && state.action === sec.action;
          return (
            <section key={sec.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1c1917' }}>
                  {sec.label}
                </h2>
                <span
                  data-testid={`section-counter-${sec.key}`}
                  style={{
                    fontFamily: '"Geist Mono", monospace', fontSize: 11, color: '#6f6a64',
                  }}
                >
                  {okCount}/{items.length}
                </span>
                <div style={{ flex: 1 }}/>
                <button
                  type="button"
                  onClick={() => void generate(sec.action)}
                  disabled={running}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 6,
                    background: running ? '#e7e5e4' : '#1c1917',
                    color: running ? '#78716c' : '#fafaf9',
                    border: 'none',
                    cursor: running ? 'default' : 'pointer',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  }}
                >
                  {running ? 'Renderizando…' : sec.buttonLabel}
                </button>
              </div>
              <div style={{
                display: 'grid', gap: 10,
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              }}>
                {items.map(it => (
                  <AssetCard key={`${it.category}/${it.relative_path}`} item={it} reloadKey={reloadKey}/>
                ))}
                {items.length === 0 && (
                  <div style={{
                    padding: '12px 14px', fontSize: 11,
                    color: '#a8a29e', fontFamily: '"Geist Mono", monospace',
                    border: '1px dashed #e7e5e4', borderRadius: 8,
                  }}>nenhum item</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface AssetCardProps {
  item: RenderManifestItem;
  reloadKey: number;
}

function AssetCard({ item, reloadKey }: AssetCardProps) {
  // Cache-bust the thumbnail when the manifest is refetched after a render —
  // otherwise the browser may keep serving the stale PNG.
  const src = item.exists ? `${item.url}?v=${reloadKey}` : null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden',
    }}>
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
        }}>
          {item.relative_path}
        </div>
        <div style={{
          fontSize: 10, color: '#6f6a64',
          fontFamily: '"Geist Mono", monospace', marginTop: 1,
        }}>
          {item.width}×{item.height}
        </div>
      </div>
    </div>
  );
}
