// Step 2: Geração — LIVE PARALLEL GRAPH. Não é um form; é o agente trabalhando.
// Mostra o que o Canvas tentava mostrar antes, mas em tempo real, com timings,
// paralelismo e streaming de tokens/renders. Esse é o ÚNICO lugar onde um grafo
// ganha seu lugar, porque aqui tempo e paralelismo são reais.

function FlowGenerate({ state }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 60);
    return () => clearInterval(id);
  }, []);

  // Pipeline: briefing/assets → agent → 4 parallel generators → validator → renders
  // Each node has start/end timings in ms
  const stages = [
    { id: 'brief',  col: 0, row: 0, label: 'Briefing',      sub: '842 tok',        start: 0,    end: 200  },
    { id: 'assets', col: 0, row: 1, label: 'Ativos',        sub: '8 itens',        start: 0,    end: 200  },
    { id: 'agent',  col: 1, row: 0.5, label: 'Agente',      sub: 'gpt-creative v3', start: 220, end: 600 },
    { id: 'copy',   col: 2, row: 0, label: 'Copy',          sub: '5 headlines',    start: 620,  end: 1400 },
    { id: 'image',  col: 2, row: 1, label: 'Imagem',        sub: '5 × 1:1',        start: 620,  end: 2000 },
    { id: 'carousel', col: 2, row: 2, label: 'Carrossel',   sub: '3 × 5 cards',    start: 1500, end: 2600 },
    { id: 'video',  col: 2, row: 3, label: 'Reels',         sub: '2 × 15s',        start: 1500, end: 3000 },
    { id: 'valid',  col: 3, row: 1.5, label: 'Validação',   sub: 'brand · lgpd',   start: 2000, end: 2400 },
    { id: 'ab',     col: 4, row: 1.5, label: 'A/B Output',  sub: '5 variantes',    start: 2400, end: 2800 },
  ];

  const edges = [
    ['brief', 'agent'], ['assets', 'agent'],
    ['agent', 'copy'], ['agent', 'image'], ['agent', 'carousel'], ['agent', 'video'],
    ['copy', 'valid'], ['image', 'valid'], ['carousel', 'valid'], ['video', 'valid'],
    ['valid', 'ab'],
  ];

  const nodeStatus = (n) => {
    if (elapsed < n.start) return 'queued';
    if (elapsed < n.end) return 'running';
    return 'done';
  };

  // Layout
  const COL_W = 160;
  const ROW_H = 78;
  const PAD_X = 20;
  const PAD_Y = 16;
  const NODE_W = 140;
  const NODE_H = 58;
  const W = PAD_X * 2 + COL_W * 4 + NODE_W;
  const H = PAD_Y * 2 + ROW_H * 4;

  const nodeById = Object.fromEntries(stages.map(s => [s.id, s]));
  const xOf = (s) => PAD_X + s.col * COL_W;
  const yOf = (s) => PAD_Y + s.row * ROW_H;

  const totalElapsed = Math.min(elapsed, 2800);
  const allDone = state === 'done' || elapsed > 2800;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minHeight: 0, overflow: 'auto',
      padding: '24px 28px 32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
            color: '#6f6a64', fontWeight: 500, marginBottom: 4,
            fontFamily: '"Geist Mono", monospace',
          }}>etapa 2 · geração em tempo real</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: -0.3 }}>
            {allDone ? '5 variantes prontas' : 'Agente trabalhando…'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <MetricChip label="decorrido" value={(totalElapsed / 1000).toFixed(1) + 's'}/>
          <MetricChip label="workers" value={countRunning(stages, elapsed) + '/9'}/>
          <MetricChip label="custo" value={'$' + (totalElapsed / 2800 * 0.022).toFixed(3)}/>
          <MetricChip label="tokens" value={Math.round(totalElapsed / 2800 * 3240)}/>
        </div>
      </div>

      {/* Graph */}
      <div style={{
        background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12,
        padding: 0, position: 'relative',
        backgroundImage: 'radial-gradient(circle, #eeeceb 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}>
        <div style={{ position: 'relative', width: '100%', height: H + 12, minWidth: W }}>
          {/* Edges */}
          <svg width={W} height={H + 12} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs>
              <marker id="arrG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="#d6d3d1"/>
              </marker>
              <marker id="arrGa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="oklch(0.65 0.18 25)"/>
              </marker>
              <marker id="arrGd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="oklch(0.55 0.15 145)"/>
              </marker>
            </defs>
            {edges.map(([from, to], i) => {
              const a = nodeById[from], b = nodeById[to];
              const x1 = xOf(a) + NODE_W, y1 = yOf(a) + NODE_H / 2;
              const x2 = xOf(b),          y2 = yOf(b) + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              const fromDone = nodeStatus(a) === 'done';
              const toActive = nodeStatus(b) === 'running';
              const bothDone = fromDone && nodeStatus(b) === 'done';
              const flowing = fromDone && toActive;
              const stroke = bothDone ? 'oklch(0.55 0.15 145)'
                : flowing ? 'oklch(0.65 0.18 25)'
                : '#e7e5e4';
              const marker = bothDone ? 'url(#arrGd)'
                : flowing ? 'url(#arrGa)'
                : 'url(#arrG)';
              return (
                <path key={i} d={path} stroke={stroke}
                  strokeWidth={flowing ? 1.6 : 1.2} fill="none"
                  markerEnd={marker}
                  strokeDasharray={flowing ? '4 3' : 'none'}
                  style={flowing ? { animation: 'dash 0.6s linear infinite' } : {}}/>
              );
            })}
          </svg>

          {/* Nodes */}
          {stages.map(n => (
            <GraphNode
              key={n.id}
              node={n}
              x={xOf(n)} y={yOf(n)} w={NODE_W} h={NODE_H}
              status={nodeStatus(n)}
              elapsed={elapsed}
            />
          ))}
        </div>

        {/* Timeline ruler at the bottom */}
        <div style={{
          borderTop: '1px solid #f0eeec',
          padding: '8px 20px 10px', display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: '"Geist Mono", monospace', fontSize: 10, color: '#78716c',
        }}>
          <span>0s</span>
          <div style={{ flex: 1, height: 4, background: '#f5f5f4', borderRadius: 2, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              width: Math.min(100, totalElapsed / 2800 * 100) + '%',
              background: allDone
                ? 'oklch(0.55 0.15 145)'
                : 'linear-gradient(90deg, oklch(0.65 0.18 25), oklch(0.7 0.2 25))',
              borderRadius: 2,
              transition: 'width 0.06s linear',
            }}/>
            {/* tick at 1s and 2s */}
            {[1, 2].map(t => (
              <div key={t} style={{
                position: 'absolute', top: -3, bottom: -3,
                left: (t / 2.8 * 100) + '%', width: 1,
                background: '#e7e5e4',
              }}/>
            ))}
          </div>
          <span>2.8s</span>
        </div>
      </div>

      {/* Live token stream under graph */}
      <TokenStream elapsed={elapsed}/>
    </div>
  );
}

function countRunning(stages, elapsed) {
  return stages.filter(s => elapsed >= s.start && elapsed < s.end).length;
}

function MetricChip({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{
        fontSize: 10, color: '#78716c', textTransform: 'uppercase',
        letterSpacing: 0.5, fontFamily: '"Geist Mono", monospace',
      }}>{label}</div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#1c1917',
        fontFamily: '"Geist Mono", monospace', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

function GraphNode({ node, x, y, w, h, status, elapsed }) {
  const isDone = status === 'done';
  const isRunning = status === 'running';
  const isQueued = status === 'queued';
  const progress = isRunning
    ? Math.min(1, (elapsed - node.start) / (node.end - node.start))
    : isDone ? 1 : 0;

  const border = isDone ? 'oklch(0.55 0.15 145 / 0.4)'
    : isRunning ? 'oklch(0.65 0.18 25 / 0.5)'
    : '#e7e5e4';
  const bg = isDone ? 'oklch(0.95 0.04 145 / 0.4)'
    : isRunning ? '#ffffff'
    : '#fafaf9';
  const statusDot = isDone ? 'oklch(0.55 0.15 145)'
    : isRunning ? 'oklch(0.65 0.18 25)'
    : '#d6d3d1';

  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 8, padding: '8px 10px',
      boxShadow: isRunning ? '0 0 0 3px oklch(0.65 0.18 25 / 0.08)' : 'none',
      transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden',
    }}>
      {/* Progress bar behind content */}
      {(isRunning || isDone) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, height: 2,
          width: (progress * 100) + '%',
          background: isDone ? 'oklch(0.55 0.15 145)' : 'oklch(0.65 0.18 25)',
          transition: 'width 0.06s linear',
        }}/>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusDot,
          animation: isRunning ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}/>
        <div style={{
          fontSize: 12, fontWeight: 500, color: isQueued ? '#a8a29e' : '#1c1917',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{node.label}</div>
        {isDone && (
          <span style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 9, color: '#78716c',
            fontVariantNumeric: 'tabular-nums',
          }}>{((node.end - node.start) / 1000).toFixed(1)}s</span>
        )}
      </div>
      <div style={{
        fontSize: 10, color: isQueued ? '#a8a29e' : '#6f6a64',
        fontFamily: '"Geist Mono", monospace',
      }}>{isRunning ? 'processando…' : isQueued ? 'na fila' : node.sub}</div>
    </div>
  );
}

function TokenStream({ elapsed }) {
  const tokens = [
    { t: 620,  text: 'Sua próxima corrida' },
    { t: 740,  text: ' começa' },
    { t: 820,  text: ' com o passo certo.' },
    { t: 940,  text: '\\nTênis Urban Run X3' },
    { t: 1080, text: ' · amortecimento' },
    { t: 1180, text: ' que responde.' },
    { t: 1320, text: '\\nCTA: Comprar agora →' },
  ];
  const visibleChars = tokens.reduce((acc, tok) => {
    if (elapsed < tok.t) return acc;
    return acc + tok.text.replace('\\n', '\n');
  }, '');

  if (elapsed < 600) return null;

  return (
    <div style={{
      marginTop: 16, padding: 14,
      background: '#1c1917', borderRadius: 10,
      display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: '#8b8680', fontFamily: '"Geist Mono", monospace',
        paddingTop: 2, width: 64, flexShrink: 0,
      }}>copy ↙</div>
      <div style={{
        flex: 1,
        fontFamily: '"Geist Mono", monospace', fontSize: 12, lineHeight: 1.65,
        color: '#fafaf9', whiteSpace: 'pre-wrap', minHeight: 44,
      }}>
        {visibleChars}
        {elapsed < 1400 && (
          <span style={{
            display: 'inline-block', width: 7, height: 14,
            background: 'oklch(0.7 0.2 25)', verticalAlign: 'text-bottom',
            marginLeft: 2, animation: 'blink 0.8s steps(2) infinite',
          }}/>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { FlowGenerate });
