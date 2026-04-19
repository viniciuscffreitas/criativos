import { useEffect, useState } from 'react';
import { DesktopChrome } from './components/DesktopChrome';
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

  const chromeW = Math.min(1480, window.innerWidth - 48);
  const chromeH = Math.min(900, window.innerHeight - 48);

  return (
    <DesktopChrome width={chromeW} height={chromeH} title={_title(nav)}>
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
            projectSlug={activeProject}
            adId="01"
            onFinish={() => setNav('gallery')}
            onGenerated={setLastRunId}
          />
        )}
        {nav === 'gallery' && <Gallery projectSlug={activeProject} onOpenCreative={setSelected} onOpenTrace={setTraceRunId}/>}
        {nav === 'brand' && <BrandLibrary/>}
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
    </DesktopChrome>
  );
}

const NAV_TITLES: Record<NavSection, string> = {
  flow: 'Novo fluxo',
  gallery: 'Galeria',
  brand: 'Marca',
};
function _title(n: NavSection): string {
  return NAV_TITLES[n];
}
