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
import { useEffect, useRef, useState } from 'react';
import { api, streamStudioRequest } from '../api';
import type { RenderManifest, RenderManifestItem, StudioStreamEvent } from '../types';
import { ConversationalPrompt } from './ConversationalPrompt';
import { StudioStream } from './StudioStream';
import { AssetCardRich } from './AssetCardRich';

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

  // Conversational layer: prompt → SSE stream of plan/copy/render events.
  // streamEvents drives StudioStream (live progress), conversationBusy
  // disables ConversationalPrompt to prevent parallel runs, and the 'done'
  // event bumps reloadKey so the manifest refetches and asset cards flip
  // from "pendente" to thumbnail.
  const [streamEvents, setStreamEvents] = useState<StudioStreamEvent[]>([]);
  const [conversationBusy, setConversationBusy] = useState(false);

  // Hold the AbortController.abort callback returned by streamStudioRequest
  // so we can cancel an in-flight stream before submitting another one and
  // when the Studio view unmounts (Cmd+1/2/3 nav). Without this the SSE
  // reader keeps draining and the backend keeps running Playwright after
  // the user has navigated away — silent half-running state per §2.7.
  const abortStreamRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => abortStreamRef.current?.();
  }, []);

  function onPrompt(prompt: string) {
    abortStreamRef.current?.();
    setStreamEvents([]);
    setConversationBusy(true);
    abortStreamRef.current = streamStudioRequest(
      { prompt, n_variants: 3 },
      (e) => setStreamEvents((prev) => [...prev, e]),
      () => {
        setConversationBusy(false);
        abortStreamRef.current = null;
        // Refetch manifest so the freshly-rendered file flips to a thumbnail
        setReloadKey((k) => k + 1);
      },
    );
  }

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

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Conversational layer — top of the Studio. The "eu peço X, você
            gera tudo" entry-point. The button-driven sections below stay
            as a fallback for "render every asset of category Y." */}
        <ConversationalPrompt onSubmit={onPrompt} busy={conversationBusy}/>
        {(conversationBusy || streamEvents.length > 0) && (
          <StudioStream events={streamEvents}/>
        )}

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
              {sec.key === 'brand' ? (
                <BrandSubGroups manifest={manifest} reloadKey={reloadKey}/>
              ) : (
                <div style={{
                  display: 'grid', gap: 10,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                }}>
                  {items.map(it => (
                    <AssetCardRich key={`${it.category}/${it.relative_path}`} item={it} reloadKey={reloadKey}/>
                  ))}
                  {items.length === 0 && (
                    <div style={{
                      padding: '12px 14px', fontSize: 11,
                      color: '#a8a29e', fontFamily: '"Geist Mono", monospace',
                      border: '1px dashed #e7e5e4', borderRadius: 8,
                    }}>nenhum item</div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface BrandSubGroupsProps {
  manifest: RenderManifest | null;
  reloadKey: number;
}

const _BRAND_SUBGROUPS: Array<{ cat: string; title: string }> = [
  { cat: 'brand-logos',    title: 'Logos' },
  { cat: 'brand-social',   title: 'Social' },
  { cat: 'brand-favicons', title: 'Favicons' },
];

// Marca section: sub-divides into Logos / Social / Favicons. Without this,
// the 15 brand assets render in one undifferentiated grid (current prod
// behaviour) and the user can't tell which is which without reading paths.
function BrandSubGroups({ manifest, reloadKey }: BrandSubGroupsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {_BRAND_SUBGROUPS.map(g => {
        const sub = manifest?.categories[g.cat] ?? [];
        if (sub.length === 0) return null;
        return (
          <div key={g.cat} data-testid={`subgroup-${g.cat}`}>
            <div style={{
              fontSize: 11, textTransform: 'uppercase',
              letterSpacing: 0.6, color: '#78716c',
              marginBottom: 8, fontFamily: '"Geist Mono", monospace',
              display: 'flex', gap: 8, alignItems: 'baseline',
            }}>
              <span>{g.title}</span>
              <span style={{ color: '#a8a29e' }}>· {sub.length}</span>
            </div>
            <div style={{
              display: 'grid', gap: 10,
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            }}>
              {sub.map(it => (
                <AssetCardRich
                  key={`${it.category}/${it.relative_path}`}
                  item={it}
                  reloadKey={reloadKey}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

