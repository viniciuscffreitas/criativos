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

  useEffect(() => { api.listProjects().then(r => setProjects(r.projects)); }, []);
  useEffect(() => { localStorage.setItem('cr_nav', nav); }, [nav]);

  const chromeW = Math.min(1480, window.innerWidth - 48);
  const chromeH = Math.min(900, window.innerHeight - 48);

  return (
    <DesktopChrome width={chromeW} height={chromeH} title={_title(nav)}>
      <Sidebar active={nav} onNav={setNav} projects={projects}
               activeProjectSlug={activeProject} onSelectProject={setActiveProject}/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
        {nav === 'flow' && <div>Flow view — Task 14</div>}
        {nav === 'gallery' && <Gallery projectSlug={activeProject} onOpenCreative={setSelected}/>}
        {nav === 'brand' && <BrandLibrary/>}
        {selected && <DetailPanel creative={selected} onClose={() => setSelected(null)}/>}
      </div>
    </DesktopChrome>
  );
}

function _title(n: NavSection) {
  return n === 'flow' ? 'Novo fluxo' : n === 'gallery' ? 'Galeria' : 'Marca';
}
