// Cross-platform neutral desktop window chrome.
// Window controls on the right (Windows-style but restrained), thin titlebar.

function DesktopChrome({ title = 'Criativos', children, width, height }) {
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

function TitleBar({ title }) {
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
        background: 'oklch(0.65 0.18 25)',
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
      {/* Window controls — neutral, small */}
      <div style={{ display: 'flex', height: '100%' }}>
        {['min', 'max', 'close'].map(k => (
          <div key={k} style={{
            width: 42, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#78716c', cursor: 'default',
          }}>
            {k === 'min' && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5h6" stroke="currentColor" strokeWidth="1"/></svg>}
            {k === 'max' && <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="none"/></svg>}
            {k === 'close' && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1"/></svg>}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { DesktopChrome, TitleBar });
