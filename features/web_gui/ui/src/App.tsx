import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { NavSection } from './components/Sidebar';
import { Gallery } from './components/Gallery';
import { DetailPanel } from './components/DetailPanel';
import { BrandLibrary } from './components/BrandLibrary';
import { CommandPalette } from './components/CommandPalette';
import { TweaksPanel } from './components/TweaksPanel';
import { GenerationTraceModal } from './components/GenerationTraceModal';
import { api } from './api';
import type { Creative, Project } from './types';
import { FlowView } from './components/FlowView';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string>('vibeweb');
  const [nav, setNav] = useState<NavSection>(
    () => (localStorage.getItem('cr_nav') as NavSection | null) ?? 'flow',
  );
  const [activeAdId, setActiveAdId] = useState<string>(
    () => localStorage.getItem('cr_ad_id') ?? '01',
  );
  const [selected, setSelected] = useState<Creative | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [traceRunId, setTraceRunId] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects()
      .then(r => setProjects(r.projects))
      .catch((e: Error) => {
        console.error('[App] listProjects failed', e);
        setLoadError(e.message);
      });
  }, []);
  useEffect(() => { localStorage.setItem('cr_nav', nav); }, [nav]);
  useEffect(() => { localStorage.setItem('cr_ad_id', activeAdId); }, [activeAdId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // ⌘K always toggles the palette (even to close it from inside).
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); return; }
      // While the palette is open, nav shortcuts belong to it — don't also fire here.
      if (paletteOpen) {
        if (e.key === 'Escape') { setPaletteOpen(false); }
        return;
      }
      if (mod && e.key === '1') { e.preventDefault(); setNav('flow'); }
      if (mod && e.key === '2') { e.preventDefault(); setNav('gallery'); }
      if (mod && e.key === '3') { e.preventDefault(); setNav('brand'); }
      if (e.key === 'Escape') { setSelected(null); setTweaksOpen(false); setTraceRunId(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [paletteOpen]);

  return (
    <div data-testid="app-shell" style={{
      width: '100vw', height: '100vh',
      display: 'flex', minHeight: 0,
      background: '#fafaf9',
      fontFamily: '"Geist", "Inter", system-ui, sans-serif',
    }}>
      <Sidebar active={nav} onNav={setNav} projects={projects}
               activeProjectSlug={activeProject} onSelectProject={setActiveProject}/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
        {loadError && (
          <div role="alert" style={{
            position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(220, 38, 38, 0.12)', color: '#f87171',
            fontFamily: '"Geist Mono", monospace', fontSize: 12,
          }}>erro ao carregar projetos: {loadError}</div>
        )}
        {nav === 'flow' && (
          <FlowView
            key={`${activeProject}/${activeAdId}`}
            projectSlug={activeProject}
            adId={activeAdId}
            onFinish={() => setNav('gallery')}
            onGenerated={setLastRunId}
            adPicker={
              <AdPicker
                adCount={projects.find(p => p.slug === activeProject)?.ad_count ?? 0}
                value={activeAdId}
                onChange={setActiveAdId}
              />
            }
          />
        )}
        {nav === 'gallery' && <Gallery projectSlug={activeProject} onOpenCreative={setSelected} onOpenTrace={setTraceRunId}/>}
        {nav === 'brand' && <BrandLibrary projectSlug={activeProject}/>}
        {selected && <DetailPanel creative={selected} onClose={() => setSelected(null)}/>}
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNav={setNav}
        onOpenTweaks={() => setTweaksOpen(true)}
        onOpenTrace={lastRunId ? () => setTraceRunId(lastRunId) : null}
      />
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
      <GenerationTraceModal runId={traceRunId} onClose={() => setTraceRunId(null)} />
    </div>
  );
}

// Ad IDs in this project follow the convention "01".."NN" (zero-padded). The
// backend keeps that format in config/ads.yaml; we generate the option list
// from the project's ad_count to avoid drift.
function adIds(adCount: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= adCount; i++) {
    out.push(String(i).padStart(2, '0'));
  }
  return out;
}

interface AdPickerProps {
  adCount: number;
  value: string;
  onChange: (id: string) => void;
}

function AdPicker({ adCount, value, onChange }: AdPickerProps) {
  const ids = adIds(adCount);
  if (ids.length === 0) return null;
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 12, color: '#57534e',
    }}>
      <span style={{
        fontFamily: '"Geist Mono", monospace',
        textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10,
        color: '#78716c',
      }}>
        Ad ativo
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: 'inherit', fontSize: 12,
          padding: '4px 8px', borderRadius: 6,
          border: '1px solid #e7e5e4', background: '#fff',
          color: '#1c1917', cursor: 'pointer',
        }}
      >
        {ids.map(id => (
          <option key={id} value={id}>Ad {id}</option>
        ))}
      </select>
    </label>
  );
}
