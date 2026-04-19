import { useEffect, useState } from 'react';
import { DesktopChrome } from './components/DesktopChrome';
import { Sidebar } from './components/Sidebar';
import type { NavSection } from './components/Sidebar';
import { Gallery } from './components/Gallery';
import { DetailPanel } from './components/DetailPanel';
import { BrandLibrary } from './components/BrandLibrary';
import { api } from './api';
import type { Creative, Project } from './types';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string>('vibeweb');
  const [nav, setNav] = useState<NavSection>(
    () => (localStorage.getItem('cr_nav') as NavSection | null) ?? 'flow',
  );
  const [selected, setSelected] = useState<Creative | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects()
      .then(r => setProjects(r.projects))
      .catch((e: Error) => {
        console.error('[App] listProjects failed', e);
        setLoadError(e.message);
      });
  }, []);
  useEffect(() => { localStorage.setItem('cr_nav', nav); }, [nav]);

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
        {nav === 'flow' && <div>Flow view — Task 14</div>}
        {nav === 'gallery' && <Gallery projectSlug={activeProject} onOpenCreative={setSelected}/>}
        {nav === 'brand' && <BrandLibrary/>}
        {selected && <DetailPanel creative={selected} onClose={() => setSelected(null)}/>}
      </div>
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
