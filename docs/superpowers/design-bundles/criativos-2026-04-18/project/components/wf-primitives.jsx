// Shared wireframe primitives. All grayscale except `--accent`.

const WF_C = {
  ink: '#1a1a1a',
  text: '#2a2a2a',
  muted: '#6b6b6b',
  dim: '#a3a3a3',
  line: '#d4d4d4',
  softline: '#e5e5e5',
  surface: '#ffffff',
  bg: '#fafafa',
  chip: '#f3f3f3',
  accent: 'oklch(0.65 0.18 25)',
  warn: 'oklch(0.7 0.14 60)',
  err: 'oklch(0.55 0.2 25)',
  ok: 'oklch(0.55 0.15 145)',
};

const wfFonts = {
  ui: '"Geist", system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
};

// ── Screen shell ────────────────────────────────────────
function WfScreen({ step, title, subtitle, states, activeState, onState, children, callouts = [], width = 560, height = 720 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingLeft: 4 }}>
        <div style={{
          fontFamily: wfFonts.mono, fontSize: 11, color: WF_C.muted,
          padding: '2px 8px', border: `1px dashed ${WF_C.line}`, borderRadius: 4,
        }}>{step}</div>
        <div style={{ fontFamily: wfFonts.ui, fontSize: 18, fontWeight: 600, color: WF_C.ink, letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{ fontFamily: wfFonts.ui, fontSize: 13, color: WF_C.muted }}>{subtitle}</div>
      </div>

      {/* State toggles */}
      {states && states.length > 0 && (
        <div style={{ display: 'flex', gap: 4, paddingLeft: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.dim,
            textTransform: 'uppercase', letterSpacing: 0.8, padding: '4px 0', marginRight: 6 }}>
            estado:
          </span>
          {states.map(s => (
            <div key={s} onClick={() => onState(s)} style={{
              fontFamily: wfFonts.mono, fontSize: 11,
              padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${activeState === s ? WF_C.ink : WF_C.line}`,
              background: activeState === s ? WF_C.ink : 'transparent',
              color: activeState === s ? WF_C.bg : WF_C.muted,
            }}>{s}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Frame */}
        <div style={{
          width, height, background: WF_C.surface,
          border: `1px solid ${WF_C.line}`,
          borderRadius: 4, position: 'relative', overflow: 'hidden',
          fontFamily: wfFonts.ui,
        }}>
          {children}
          {/* Callout pins */}
          {callouts.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', left: c.x, top: c.y,
              width: 22, height: 22, borderRadius: '50%',
              background: WF_C.accent, color: '#fff',
              fontFamily: wfFonts.mono, fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              border: '2px solid #fff',
            }}>{i + 1}</div>
          ))}
        </div>

        {/* Callout legend */}
        {callouts.length > 0 && (
          <div style={{ width: 240, flexShrink: 0, paddingTop: 4 }}>
            {callouts.map((c, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '8px 0',
                borderTop: i === 0 ? 'none' : `1px dashed ${WF_C.softline}`,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: WF_C.accent, color: '#fff',
                  fontFamily: wfFonts.mono, fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
                <div style={{ fontSize: 12, color: WF_C.text, lineHeight: 1.45 }}>
                  {c.note}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Primitives ─────────────────────────────────────────
function WfBar({ width = '60%', height = 8, muted = 0.6 }) {
  return <div style={{ width, height, background: WF_C.line, opacity: muted, borderRadius: 2 }}/>;
}

function WfBox({ children, style, dashed }) {
  return (
    <div style={{
      border: `1px ${dashed ? 'dashed' : 'solid'} ${WF_C.line}`,
      borderRadius: 4, background: WF_C.surface,
      ...style,
    }}>{children}</div>
  );
}

function WfBtn({ label, primary, ghost, size = 'md', hint, style }) {
  const pad = size === 'sm' ? '5px 10px' : '8px 14px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 4, fontSize: fs,
      fontFamily: wfFonts.ui, fontWeight: 500,
      background: primary ? WF_C.ink : ghost ? 'transparent' : '#fff',
      color: primary ? '#fff' : ghost ? WF_C.muted : WF_C.ink,
      border: primary ? 'none' : `1px solid ${WF_C.line}`,
      cursor: 'pointer', userSelect: 'none',
      ...style,
    }}>
      {label}
      {hint && <span style={{ fontFamily: wfFonts.mono, fontSize: 10, opacity: 0.6 }}>{hint}</span>}
    </div>
  );
}

function WfChip({ children, variant = 'default', style }) {
  const map = {
    default: { bg: WF_C.chip, color: WF_C.muted, border: 'transparent' },
    accent: { bg: 'oklch(0.97 0.02 25)', color: WF_C.accent, border: 'oklch(0.9 0.06 25)' },
    warn: { bg: 'oklch(0.97 0.03 60)', color: WF_C.warn, border: 'oklch(0.88 0.08 60)' },
    err: { bg: 'oklch(0.96 0.03 25)', color: WF_C.err, border: 'oklch(0.88 0.1 25)' },
    ok: { bg: 'oklch(0.96 0.03 145)', color: WF_C.ok, border: 'oklch(0.88 0.06 145)' },
    dark: { bg: WF_C.ink, color: '#fff', border: WF_C.ink },
  };
  const c = map[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: wfFonts.mono, fontSize: 10,
      padding: '2px 7px', borderRadius: 3,
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      ...style,
    }}>{children}</span>
  );
}

function WfDiv({ h = 1, style }) {
  return <div style={{ height: h, background: WF_C.softline, ...style }}/>;
}

function WfLabel({ children }) {
  return <div style={{
    fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.dim,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  }}>{children}</div>;
}

// Window chrome (tiny, neutral)
function WfChrome({ title, children, width, height }) {
  return (
    <div style={{
      width, height, display: 'flex', flexDirection: 'column',
      background: WF_C.surface, border: `1px solid ${WF_C.line}`,
      borderRadius: 6, overflow: 'hidden',
    }}>
      <div style={{
        height: 28, background: '#f8f8f8',
        borderBottom: `1px solid ${WF_C.softline}`,
        display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
        fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.muted,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: WF_C.line }}/>)}
        </div>
        <span style={{ marginLeft: 8 }}>{title}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { WF_C, wfFonts, WfScreen, WfBar, WfBox, WfBtn, WfChip, WfDiv, WfLabel, WfChrome });
