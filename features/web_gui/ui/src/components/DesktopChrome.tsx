// Cross-platform neutral desktop window chrome — thin titlebar with dot logo
// and breadcrumb. No window controls (this is a web app, not Electron — we
// cannot minimize/maximize/close anything).
import React from 'react';

interface DesktopChromeProps {
  title?: string;
  width: number;
  height: number;
  children: React.ReactNode;
}

export function DesktopChrome({ title = 'Criativos', children, width, height }: DesktopChromeProps) {
  return (
    <div style={{
      width, height, borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 40px 80px -20px rgba(28,25,23,0.25), 0 0 0 1px rgba(28,25,23,0.08)',
      display: 'flex', flexDirection: 'column',
      background: '#fafaf9',
      fontFamily: '"Geist", "Inter", system-ui, sans-serif',
    }}>
      <TitleBar title={title} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {children}
      </div>
    </div>
  );
}

function TitleBar({ title }: { title: string }) {
  return (
    <div style={{
      height: 36, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      background: '#ffffff',
      borderBottom: '1px solid #e7e5e4',
      padding: '0 0 0 12px',
      fontSize: 12, color: '#78716c',
      letterSpacing: 0.1,
      userSelect: 'none',
    }}>
      {/* Dot logo */}
      <div style={{
        width: 14, height: 14, borderRadius: 4,
        background: 'var(--accent)',
        marginRight: 10, position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 3,
          background: '#fff', borderRadius: 1.5,
        }}/>
      </div>
      <span style={{ color: '#44403c', fontWeight: 500 }}>Criativos</span>
      <span style={{ margin: '0 8px', color: '#d6d3d1' }}>/</span>
      <span>{title}</span>
      <div style={{ flex: 1 }} />
      <div style={{ width: 12 }} />
    </div>
  );
}
