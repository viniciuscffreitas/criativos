// Workflow canvas — the AI agent as a visual graph.
// Nodes are draggable-looking (static positions for mock), connected via SVG paths.
// Pan/zoom bg with dotted grid. Active node shows streaming state.

const NODE_W = 220;

function WorkflowCanvas({ streaming, onOpenCreative, selectedCreative }) {
  // Nodes with positions
  const nodes = [
    { id: 'brief', x: 60, y: 80, type: 'input', title: 'Briefing', subtitle: 'Tênis Urban Run · Q2', status: 'done',
      fields: [
        { k: 'Produto', v: 'Tênis Urban Run X3' },
        { k: 'Objetivo', v: 'Conversão · vendas' },
        { k: 'Público', v: 'H/M · 22–38 · urbano' },
        { k: 'Tom', v: 'Energético, confiante' },
      ]
    },
    { id: 'assets', x: 60, y: 330, type: 'input', title: 'Ativos da marca', subtitle: '8 itens', status: 'done',
      fields: [
        { k: 'Logos', v: '3' },
        { k: 'Fotos produto', v: '12' },
        { k: 'Paleta', v: '5 cores' },
      ]
    },
    { id: 'agent', x: 360, y: 180, type: 'agent', title: 'Agente Criativo', subtitle: 'gpt-creative v3',
      status: streaming ? 'streaming' : 'done' },
    { id: 'copy', x: 680, y: 60, type: 'generator', title: 'Copy', subtitle: 'Headlines + descrições', status: 'done', count: 6 },
    { id: 'image', x: 680, y: 220, type: 'generator', title: 'Imagem estática', subtitle: 'feed 1:1 · 1080px', status: streaming ? 'streaming' : 'done', count: 4 },
    { id: 'carousel', x: 680, y: 380, type: 'generator', title: 'Carrossel', subtitle: '5 cards · feed', status: streaming ? 'queued' : 'done', count: 3 },
    { id: 'video', x: 680, y: 540, type: 'generator', title: 'Reels / Stories', subtitle: '9:16 · 15s', status: streaming ? 'queued' : 'done', count: 2 },
    { id: 'ab', x: 1000, y: 280, type: 'output', title: 'A/B Variações', subtitle: 'Comparativo', status: streaming ? 'queued' : 'done' },
  ];

  // Connections
  const connections = [
    ['brief', 'agent'], ['assets', 'agent'],
    ['agent', 'copy'], ['agent', 'image'], ['agent', 'carousel'], ['agent', 'video'],
    ['copy', 'ab'], ['image', 'ab'], ['carousel', 'ab'], ['video', 'ab'],
  ];

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Canvas dims
  const W = 1280, H = 720;

  return (
    <div style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      background: '#fafaf9',
      backgroundImage: 'radial-gradient(circle, #e7e5e4 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundPosition: '-1px -1px',
    }}>
      {/* Top toolbar */}
      <CanvasToolbar streaming={streaming} />

      {/* Connections layer */}
      <svg width={W} height={H} style={{ position: 'absolute', top: 56, left: 0, pointerEvents: 'none' }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#d6d3d1"/>
          </marker>
          <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="oklch(0.65 0.18 25)"/>
          </marker>
        </defs>
        {connections.map(([from, to], i) => {
          const a = nodeMap[from], b = nodeMap[to];
          const x1 = a.x + NODE_W, y1 = a.y + nodeHeight(a) / 2;
          const x2 = b.x, y2 = b.y + nodeHeight(b) / 2;
          const mx = (x1 + x2) / 2;
          const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          const isActiveFlow = streaming && (
            (from === 'brief' || from === 'assets') && to === 'agent' ||
            from === 'agent' && to === 'image'
          );
          return (
            <path key={i} d={path} stroke={isActiveFlow ? 'oklch(0.65 0.18 25)' : '#d6d3d1'}
              strokeWidth={isActiveFlow ? 1.8 : 1.2} fill="none"
              markerEnd={isActiveFlow ? 'url(#arrow-active)' : 'url(#arrow)'}
              strokeDasharray={isActiveFlow ? '4 3' : 'none'}
              style={isActiveFlow ? { animation: 'dash 0.6s linear infinite' } : {}}/>
          );
        })}
      </svg>

      {/* Nodes layer */}
      <div style={{ position: 'absolute', top: 56, left: 0, right: 0, bottom: 0 }}>
        {nodes.map(n => (
          <Node key={n.id} node={n} onOpenCreative={onOpenCreative} streaming={streaming}/>
        ))}
      </div>

      {/* Zoom controls */}
      <ZoomControls />
    </div>
  );
}

function nodeHeight(n) {
  if (n.type === 'input') return 40 + (n.fields?.length || 0) * 24 + 40;
  if (n.type === 'agent') return 140;
  if (n.type === 'generator') return 96;
  if (n.type === 'output') return 96;
  return 80;
}

function CanvasToolbar({ streaming }) {
  return (
    <div style={{
      height: 56, flexShrink: 0, background: '#ffffff',
      borderBottom: '1px solid #e7e5e4',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      position: 'relative', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 style={{
          margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917',
          letterSpacing: -0.1,
        }}>Fluxo criativo</h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
        }}>v3 · auto-sync</span>
      </div>

      <div style={{ flex: 1 }}/>

      {streaming && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 6,
          background: 'oklch(0.65 0.18 25 / 0.08)',
          color: 'oklch(0.45 0.18 25)',
          fontSize: 12, fontWeight: 500,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'oklch(0.65 0.18 25)',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}/>
          Gerando criativos…
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <IconBtn icon={IconRefresh} label="Regerar"/>
        <IconBtn icon={IconDownload} label="Exportar"/>
        <IconBtn icon={IconMore} label="Mais"/>
      </div>

      <div style={{ width: 1, height: 20, background: '#e7e5e4' }}/>

      <button style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 6,
        background: '#1c1917', color: '#fafaf9',
        border: 'none', fontSize: 12, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer',
      }}>
        <IconZap size={13}/>
        Executar fluxo
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          opacity: 0.5, marginLeft: 4,
        }}>⌘↵</span>
      </button>
    </div>
  );
}

function IconBtn({ icon: I, label, onClick }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', background: 'transparent', borderRadius: 6,
      color: '#57534e', cursor: 'pointer',
    }}>
      <I size={15}/>
    </button>
  );
}

function ZoomControls() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16,
      display: 'flex', alignItems: 'center',
      background: '#ffffff', border: '1px solid #e7e5e4',
      borderRadius: 8, padding: 2,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      fontSize: 12,
    }}>
      {['−', '100%', '+'].map((l, i) => (
        <div key={i} style={{
          padding: i === 1 ? '6px 10px' : '6px 10px',
          color: '#57534e', cursor: 'pointer',
          fontFamily: i === 1 ? '"Geist Mono", monospace' : 'inherit',
          fontSize: i === 1 ? 11 : 14,
          minWidth: i === 1 ? 44 : 'auto',
          textAlign: 'center',
        }}>{l}</div>
      ))}
    </div>
  );
}

Object.assign(window, { WorkflowCanvas, Node: null });
