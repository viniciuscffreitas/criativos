// Individual node types for the workflow canvas

function Node({ node, onOpenCreative, streaming }) {
  const n = node;
  const common = {
    position: 'absolute', left: n.x, top: n.y, width: NODE_W,
    background: '#ffffff', borderRadius: 10,
    border: '1px solid #e7e5e4',
    boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 4px 12px rgba(28,25,23,0.04)',
    fontSize: 12,
    overflow: 'hidden',
  };

  if (n.type === 'input') return <InputNode node={n} style={common} />;
  if (n.type === 'agent') return <AgentNode node={n} style={common} streaming={streaming}/>;
  if (n.type === 'generator') return <GeneratorNode node={n} style={common} onOpenCreative={onOpenCreative}/>;
  if (n.type === 'output') return <OutputNode node={n} style={common}/>;
  return null;
}

function NodeHeader({ icon: I, title, subtitle, accent = '#78716c', status, chip }) {
  return (
    <div style={{
      padding: '10px 12px 8px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: accent + '14', color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <I size={14}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1,
        }}>
          {title}
          {chip}
        </div>
        <div style={{ fontSize: 11, color: '#6f6a64', marginTop: 1 }}>{subtitle}</div>
      </div>
      <StatusDot status={status}/>
    </div>
  );
}

function StatusDot({ status }) {
  const map = {
    done: { c: '#16a34a', label: 'ok' },
    streaming: { c: 'oklch(0.65 0.18 25)', label: 'ativo' },
    queued: { c: '#d6d3d1', label: 'fila' },
    error: { c: '#dc2626', label: 'erro' },
  };
  const { c } = map[status] || map.queued;
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', background: c,
      marginTop: 8, flexShrink: 0,
      animation: status === 'streaming' ? 'pulse 1.2s ease-in-out infinite' : 'none',
    }}/>
  );
}

// ── Input node: brief / assets ───────────────────────────
function InputNode({ node, style }) {
  return (
    <div style={style}>
      <NodeHeader
        icon={node.id === 'brief' ? IconTarget : IconLayers}
        title={node.title}
        subtitle={node.subtitle}
        accent="#78716c"
        status={node.status}
      />
      <div style={{ padding: '2px 12px 12px' }}>
        {node.fields.map((f, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 0', fontSize: 11,
            borderTop: i > 0 ? '1px solid #f5f5f4' : 'none',
          }}>
            <span style={{ color: '#6f6a64' }}>{f.k}</span>
            <span style={{
              color: '#44403c', fontWeight: 500,
              maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{f.v}</span>
          </div>
        ))}
      </div>
      <Handle side="right" y={nodeHeight(node)/2}/>
    </div>
  );
}

// ── Agent node: central, "thinking" state ────────────────
function AgentNode({ node, style, streaming }) {
  return (
    <div style={{
      ...style,
      border: streaming ? '1px solid oklch(0.65 0.18 25 / 0.4)' : '1px solid #1c1917',
      background: streaming ? 'linear-gradient(180deg, #fff, oklch(0.95 0.02 25))' : '#1c1917',
      color: streaming ? '#1c1917' : '#fafaf9',
      boxShadow: streaming
        ? '0 0 0 4px oklch(0.65 0.18 25 / 0.08), 0 4px 12px rgba(28,25,23,0.04)'
        : '0 4px 20px rgba(28,25,23,0.15)',
    }}>
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: streaming ? 'oklch(0.65 0.18 25)' : '#fafaf9',
          color: streaming ? '#fff' : '#1c1917',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: streaming ? 'spin 4s linear infinite' : 'none',
        }}>
          <IconSparkle size={17}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.1 }}>{node.title}</div>
          <div style={{
            fontSize: 10, marginTop: 1,
            fontFamily: '"Geist Mono", monospace',
            color: streaming ? '#78716c' : '#a8a29e',
          }}>{node.subtitle}</div>
        </div>
      </div>

      {/* Thinking / idle trace */}
      <div style={{
        margin: '0 14px 12px', padding: '8px 10px',
        background: streaming ? '#ffffff' : 'rgba(250,250,249,0.06)',
        border: streaming ? '1px solid #e7e5e4' : '1px solid rgba(250,250,249,0.1)',
        borderRadius: 6,
        fontFamily: '"Geist Mono", monospace', fontSize: 11,
        lineHeight: 1.6,
        color: streaming ? '#57534e' : '#a8a29e',
      }}>
        {streaming ? (
          <>
            <div>› analisando briefing…</div>
            <div>› gerando 4 variações de imagem</div>
            <div style={{ color: 'oklch(0.55 0.18 25)' }}>
              › compondo cena urbana <Blink/>
            </div>
          </>
        ) : (
          <>
            <div>› fluxo completo</div>
            <div>› 15 criativos gerados · 42s</div>
          </>
        )}
      </div>

      <Handle side="left" y={nodeHeight(node)/2} dark={!streaming}/>
      <Handle side="right" y={nodeHeight(node)/2} dark={!streaming}/>
    </div>
  );
}

function Blink() {
  return <span style={{ display: 'inline-block', width: 6, height: 10, background: 'currentColor',
    verticalAlign: 'middle', marginLeft: 2, animation: 'blink 1s step-end infinite' }}/>;
}

// ── Generator node: produces creatives ───────────────────
function GeneratorNode({ node, style, onOpenCreative }) {
  const iconMap = {
    copy: IconText, image: IconImage, carousel: IconLayers, video: IconVideo,
  };
  const I = iconMap[node.id] || IconImage;

  // Preview thumbnails
  const thumbs = getThumbs(node.id, node.count || 3);

  return (
    <div style={style}>
      <NodeHeader
        icon={I}
        title={node.title}
        subtitle={node.subtitle}
        accent="oklch(0.55 0.18 25)"
        status={node.status}
        chip={<span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '1px 5px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c', fontWeight: 500,
        }}>×{node.count}</span>}
      />
      <div style={{ padding: '0 10px 10px', display: 'flex', gap: 4 }}>
        {thumbs.map((t, i) => (
          <div key={i} onClick={() => onOpenCreative(node.id, i)}
            style={{
              flex: 1, aspectRatio: '1', borderRadius: 4,
              background: t.bg, overflow: 'hidden', cursor: 'pointer',
              position: 'relative',
              border: '1px solid #e7e5e4',
            }}>
            {t.content}
            {node.status === 'streaming' && i === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
                animation: 'shimmer 1.5s infinite',
              }}/>
            )}
          </div>
        ))}
      </div>
      <Handle side="left" y={nodeHeight(node)/2}/>
      <Handle side="right" y={nodeHeight(node)/2}/>
    </div>
  );
}

// Placeholder thumbnail generator
function getThumbs(kind, count) {
  const palette = [
    { bg: 'linear-gradient(135deg, #fed7aa, #fb923c)' },
    { bg: 'linear-gradient(135deg, #1c1917, #44403c)' },
    { bg: 'linear-gradient(135deg, #fafaf9, #e7e5e4)' },
    { bg: 'linear-gradient(135deg, oklch(0.65 0.18 25), oklch(0.5 0.18 25))' },
    { bg: 'linear-gradient(135deg, #292524, #57534e)' },
    { bg: 'linear-gradient(135deg, #fef3c7, #fbbf24)' },
  ];
  const arr = [];
  for (let i = 0; i < count && i < 4; i++) {
    const p = palette[i % palette.length];
    arr.push({
      bg: p.bg,
      content: kind === 'copy' ? (
        <div style={{ padding: 6, fontSize: 6, lineHeight: 1.3, color: i === 1 ? '#fff' : '#1c1917' }}>
          <div style={{ height: 2, background: 'currentColor', opacity: 0.4, marginBottom: 2, width: '80%' }}/>
          <div style={{ height: 2, background: 'currentColor', opacity: 0.4, marginBottom: 2, width: '60%' }}/>
          <div style={{ height: 2, background: 'currentColor', opacity: 0.4, width: '70%' }}/>
        </div>
      ) : null,
    });
  }
  return arr;
}

// ── Output node: A/B comparison ──────────────────────────
function OutputNode({ node, style }) {
  return (
    <div style={style}>
      <NodeHeader
        icon={IconWand}
        title={node.title}
        subtitle={node.subtitle}
        accent="#1c1917"
        status={node.status}
      />
      <div style={{
        padding: '2px 12px 12px', fontSize: 11, color: '#78716c',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>15 criativos prontos</span>
        <span style={{
          fontFamily: '"Geist Mono", monospace',
          color: '#16a34a', fontWeight: 500,
        }}>+23% CTR est.</span>
      </div>
      <Handle side="left" y={nodeHeight(node)/2}/>
    </div>
  );
}

// Connector handle
function Handle({ side, y, dark }) {
  return (
    <div style={{
      position: 'absolute',
      [side]: -5, top: y - 5,
      width: 10, height: 10, borderRadius: '50%',
      background: '#ffffff',
      border: `1.5px solid ${dark ? '#fafaf9' : '#d6d3d1'}`,
    }}/>
  );
}

Object.assign(window, { Node, InputNode, AgentNode, GeneratorNode, OutputNode });
