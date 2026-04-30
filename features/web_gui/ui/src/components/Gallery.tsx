// Gallery view — grid of all generated creatives, filterable by kind.
// Data is fetched from the backend via fetchCreatives; no hardcoded samples.
import { useState, useEffect, useRef } from 'react';
import type { Creative } from '../types';
import { fetchCreatives } from '../data/creatives';
import {
  IconSearch, IconPlus, IconPlay, IconCanvas,
} from './icons';
import { formatShortcut } from '../platform';

interface GalleryProps {
  projectSlug: string;
  onOpenCreative: (c: Creative) => void;
  onOpenTrace: (runId: string) => void;
}

export function Gallery({ projectSlug, onOpenCreative, onOpenTrace }: GalleryProps) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    fetchCreatives(projectSlug)
      .then(setCreatives)
      .catch((err: unknown) => {
        console.error('[Gallery] fetchCreatives failed:', err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [projectSlug]);

  const byKind = (k: string) => creatives.filter(c => c.kind === k);
  const filtered = filter === 'all' ? creatives : creatives.filter(c => c.kind === filter);

  const tabs = [
    { id: 'all', label: 'Todos', count: creatives.length },
    { id: 'image', label: 'Imagens', count: byKind('image').length },
    { id: 'video', label: 'Vídeos', count: byKind('video').length },
    { id: 'carousel', label: 'Carrosséis', count: byKind('carousel').length },
    { id: 'copy', label: 'Copy', count: byKind('copy').length },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafaf9' }}>
      {/* Toolbar */}
      <div style={{
        height: 56, flexShrink: 0, background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1, flexShrink: 0 }}>
          Galeria
        </h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{creatives.length} criativos</span>
        <div style={{ flex: 1 }}/>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 6,
          background: '#fafaf9', border: '1px solid #e7e5e4',
          width: 220, fontSize: 12, color: '#6f6a64',
        }}>
          <IconSearch size={13}/>
          <span>Buscar…</span>
          <div style={{ flex: 1 }}/>
          <span style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 10,
            padding: '1px 5px', borderRadius: 4,
            background: '#fff', border: '1px solid #e7e5e4',
          }}>{formatShortcut('K')}</span>
        </div>
        <button style={btnPrimary}><IconPlus size={13}/> Novo criativo</button>
      </div>

      <FilterTabs tabs={tabs} filter={filter} onChange={setFilter} />

      {/* Error state */}
      {error && (
        <div style={{
          margin: 20, padding: '10px 14px', borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fecaca',
          fontSize: 12, color: '#dc2626',
          fontFamily: '"Geist Mono", monospace',
        }}>
          erro ao carregar: {error}
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, minHeight: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gridAutoRows: 'max-content',
          gap: 16,
        }}>
          {filtered.map((c, i) => {
            const runId = c.last_run_id;
            return (
              <GalleryCard key={c.id} creative={c} idx={i}
                onOpen={() => onOpenCreative(c)}
                onOpenTrace={runId ? () => onOpenTrace(runId) : null}/>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface FilterTab {
  id: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  filter: string;
  onChange: (id: string) => void;
}

function FilterTabs({ tabs, filter, onChange }: FilterTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.findIndex(t => t.id === filter);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" style={{
      padding: '12px 20px 0', background: '#fff',
      borderBottom: '1px solid #e7e5e4',
      display: 'flex', gap: 4,
    }}>
      {tabs.map((t, i) => {
        const active = filter === t.id;
        return (
          <button
            key={t.id}
            ref={el => { refs.current[i] = el; }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
            style={{
              padding: '8px 12px', fontSize: 12, cursor: 'pointer',
              color: active ? '#1c1917' : '#78716c',
              fontWeight: active ? 500 : 400,
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              background: 'transparent',
              marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}
          >
            {t.label}
            <span style={{
              fontSize: 10, color: '#6f6a64',
              fontFamily: '"Geist Mono", monospace',
            }}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

interface GalleryCardProps {
  creative: Creative;
  idx: number;
  onOpen: () => void;
  onOpenTrace: (() => void) | null;
}

function GalleryCard({ creative, idx, onOpen, onOpenTrace }: GalleryCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onOpen}
      data-testid="creative-card"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', borderRadius: 10,
        border: '1px solid #e7e5e4',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: hover ? '0 8px 20px rgba(28,25,23,0.08)' : '0 1px 2px rgba(28,25,23,0.02)',
        transform: hover ? 'translateY(-2px)' : 'none',
        animation: `fadeInUp 0.3s ease-out ${idx * 0.03}s backwards`,
      }}>
      <div style={{
        aspectRatio: creative.kind === 'video' ? '9/16' : '1',
        maxHeight: creative.kind === 'video' ? 240 : 'auto',
        background: 'var(--border)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex', alignItems: 'flex-end', padding: 14,
      }}>
        {/* Thumbnail image */}
        {creative.thumbnail_url ? (
          <img
            src={creative.thumbnail_url}
            alt={creative.title}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : null}

        {/* Video play overlay */}
        {creative.kind === 'video' && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', zIndex: 2,
          }}><IconPlay size={14}/></div>
        )}

        {/* Copy kind: headline text */}
        {creative.kind === 'copy' ? (
          <div style={{
            position: 'relative', zIndex: 2,
            fontSize: 14, fontWeight: 700, color: '#1c1917',
            letterSpacing: -0.3, lineHeight: 1.2,
          }}>{creative.headline}</div>
        ) : (
          <div style={{
            position: 'relative', zIndex: 2,
            fontSize: 15, fontWeight: 700, color: '#fff',
            letterSpacing: -0.3, lineHeight: 1.1,
            textShadow: '0 1px 6px rgba(0,0,0,0.3)',
          }}>{creative.hero || creative.headline}</div>
        )}

        {/* Streaming shimmer */}
        {creative.status === 'streaming' && (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 3,
              background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
              animation: 'shimmer 1.5s infinite',
            }}/>
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 4,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.95)', color: 'var(--accent)',
              fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: '"Geist Mono", monospace',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}/>
              gerando
            </div>
          </>
        )}

        {/* Kind badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          padding: '3px 7px', borderRadius: 4,
          background: 'rgba(28,25,23,0.7)', backdropFilter: 'blur(8px)',
          color: '#fff', fontSize: 10, fontWeight: 500,
          fontFamily: '"Geist Mono", monospace',
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{creative.kind}</div>

        {/* Hover action: ver trace — only when this creative has been generated */}
        {hover && onOpenTrace && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenTrace(); }}
            style={{
              position: 'absolute', bottom: 10, right: 10, zIndex: 2,
              padding: '5px 9px', borderRadius: 6,
              background: 'rgba(28,25,23,0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 10, fontWeight: 500,
              fontFamily: '"Geist Mono", monospace',
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              animation: 'fadeIn 0.12s ease-out',
            }}
            title="Ver como foi gerado"
          >
            <IconCanvas size={11}/>
            ver trace
          </button>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: '#1c1917',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{creative.title}</div>
        <div style={{
          fontSize: 10, color: '#6f6a64', marginTop: 2,
          fontFamily: '"Geist Mono", monospace',
        }}>{creative.id} · {creative.format}</div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 6,
  background: '#1c1917', color: '#fafaf9', border: 'none',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
