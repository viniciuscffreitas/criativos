// Placeholder — Tasks 13+ replace this with the real UI
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Project } from './types';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    api.listProjects().then((r) => setProjects(r.projects));
  }, []);
  return (
    <div style={{ padding: 24, fontFamily: 'Geist, system-ui' }}>
      <h1>Vibe Web Criativos</h1>
      <ul>
        {projects.map((p) => (
          <li key={p.slug}>
            {p.name} — {p.ad_count} ads
          </li>
        ))}
      </ul>
    </div>
  );
}
