// Left sidebar + project list (active-project header + switcher list).
//
// The project HEADER at the top is display-only — it shows which project the
// rest of the UI is acting on. The actual project switcher is the
// "Projetos recentes" list below; clicking an inactive project there
// re-mounts FlowView/Gallery/BrandLibrary against the new slug. Clicking
// the ACTIVE project is a no-op (you're already on it) — so we set
// cursor:default + skip the onSelectProject call to avoid surprise re-loads.
//
// When there's only 1 project, the list still renders (so the user sees
// what's available) but adds a small "Projeto único" caption to explain
// why clicks don't navigate anywhere.
import type { Project } from '../types';
import { IconSparkle, IconGrid, IconBrand, IconCanvas } from './icons';
import { formatShortcut } from '../platform';

export type NavSection = 'flow' | 'gallery' | 'brand' | 'studio';

interface SidebarProps {
  active: NavSection;
  onNav: (nav: NavSection) => void;
  projects: Project[];
  activeProjectSlug: string;
  onSelectProject: (slug: string) => void;
}

export function Sidebar({ active, onNav, projects, activeProjectSlug, onSelectProject }: SidebarProps) {
  const sections = [
    { id: 'flow' as const, label: 'Novo fluxo', icon: IconSparkle, shortcut: '1' },
    { id: 'gallery' as const, label: 'Galeria', icon: IconGrid, shortcut: '2' },
    { id: 'brand' as const, label: 'Marca', icon: IconBrand, shortcut: '3' },
    { id: 'studio' as const, label: 'Studio', icon: IconCanvas, shortcut: '4' },
  ];

  const activeProject = projects.find(p => p.slug === activeProjectSlug);
  const activeProjectName = activeProject?.name ?? activeProjectSlug;
  const initials = activeProjectName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const isSingleProject = projects.length === 1;

  return (
    <div style={{
      width: 232, flexShrink: 0, background: '#ffffff',
      borderRight: '1px solid #e7e5e4',
      display: 'flex', flexDirection: 'column',
      fontSize: 13,
    }}>
      {/* Active-project header (display-only) */}
      <div style={{ padding: '14px 12px 10px' }}>
        <div data-testid="project-switcher" style={{
          padding: '10px 12px', borderRadius: 8,
          background: '#fafaf9', border: '1px solid #e7e5e4',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'default',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #fed7aa, #fdba74)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#9a3412',
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProjectName}
            </div>
            <div style={{ fontSize: 11, color: '#6f6a64', marginTop: 1 }}>Projeto ativo</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '2px 8px' }}>
        {sections.map(s => {
          const I = s.icon;
          const isActive = s.id === active;
          return (
            <div key={s.id} onClick={() => onNav(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 6,
              color: isActive ? '#1c1917' : '#57534e',
              background: isActive ? '#f5f5f4' : 'transparent',
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer', marginBottom: 1,
            }}>
              <I size={15} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: 10, color: '#6f6a64',
                padding: '1px 5px', borderRadius: 4,
                background: isActive ? '#fff' : 'transparent',
                border: isActive ? '1px solid #e7e5e4' : '1px solid transparent',
              }}>{formatShortcut(s.shortcut)}</span>
            </div>
          );
        })}
      </div>

      {/* Project list */}
      <div style={{
        padding: '20px 16px 8px', fontSize: 11, textTransform: 'uppercase',
        letterSpacing: 0.6, color: '#6f6a64', fontWeight: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Projetos recentes</span>
        {isSingleProject && (
          <span style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 9, fontWeight: 400,
            textTransform: 'lowercase', letterSpacing: 0,
            color: '#a8a29e',
          }}>projeto único</span>
        )}
      </div>
      <div style={{ padding: '0 8px', flex: 1, overflow: 'auto' }}>
        {projects.map((p) => {
          const isActive = p.slug === activeProjectSlug;
          // Active row is display-only; inactive rows switch project on click.
          const handleClick = isActive ? undefined : () => onSelectProject(p.slug);
          return (
            <div key={p.slug} onClick={handleClick} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6,
              color: isActive ? '#1c1917' : '#78716c',
              background: isActive ? '#f5f5f4' : 'transparent',
              fontWeight: isActive ? 500 : 400,
              cursor: isActive ? 'default' : 'pointer',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isActive ? 'var(--accent)' : '#d6d3d1',
              }}/>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, color: '#6f6a64' }}>
                {p.ad_count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
