// Post-mortem: "Ver como foi gerado" modal — the afterlife of Canvas.
// Opens from Gallery hover action. Shows the exact graph that produced THIS creative,
// with real timings, token counts, and per-node confidence. Read-only inspector.

function GenerationTraceModal({ creative, onClose }) {
  const [selectedNode, setSelectedNode] = React.useState(null);

  // A deterministic trace per creative (based on creative.id hash)
  const seed = (creative.id || 'v1').charCodeAt(0) % 4;
  const kindDuration = {
    image: 2100, copy: 1400, carousel: 2600, video: 3000,
  }[creative.kind] || 2100;

  const stages = [
    { id: 'brief',    col: 0, row: 0, label: 'Briefing',    sub: '842 tok',          start: 0,    end: 180 + seed * 20,  tokens: 842,  confidence: 0.98 },
    { id: 'assets',   col: 0, row: 1, label: 'Ativos',      sub: '8 itens',          start: 0,    end: 200,               tokens: 0,    confidence: 1.00 },
    { id: 'agent',    col: 1, row: 0.5, label: 'Agente',    sub: 'gpt-creative v3',  start: 220,  end: 580 + seed * 30,   tokens: 520,  confidence: 0.94 },
    { id: 'copy',     col: 2, row: 0, label: 'Copy',        sub: '5 headlines',      start: 620,  end: 1400,              tokens: 1240, confidence: 0.96 },
    { id: 'media',    col: 2, row: 1, label: creative.kind === 'copy' ? 'Validação copy' : 'Render ' + creative.kind,
      sub: creative.format || '1080 · 1:1',              start: 620,  end: kindDuration,      tokens: 180, confidence: creative.confidence || 0.82 },
    { id: 'valid',    col: 3, row: 0.5, label: 'Validação', sub: 'brand · lgpd · copy',  start: kindDuration, end: kindDuration + 320, tokens: 300, confidence: 0.91 },
    { id: 'output',   col: 4, row: 0.5, label: 'Output ' + (creative.id || 'V1'),  sub: 'final',    start: kindDuration + 320,  end: kindDuration + 500,  tokens: 0,   confidence: creative.confidence || 0.88 },
  ];

  const edges = [
    ['brief', 'agent'], ['assets', 'agent'],
    ['agent', 'copy'], ['agent', 'media'],
    ['copy', 'valid'], ['media', 'valid'],
    ['valid', 'output'],
  ];

  const total = stages[stages.length - 1].end;
  const totalTokens = stages.reduce((a, b) => a + (b.tokens || 0), 0);

  const COL_W = 160, ROW_H = 80, PAD_X = 24, PAD_Y = 24, NODE_W = 140, NODE_H = 62;
  const W = PAD_X * 2 + COL_W * 4 + NODE_W;
  const H = PAD_Y * 2 + ROW_H * 2;
  const nodeById = Object.fromEntries(stages.map(s => [s.id, s]));

  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const sel = selectedNode ? nodeById[selectedNode] : null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(28,25,23,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, animation: 'fadeIn 0.12s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(960px, 100%)', maxHeight: '100%', overflow: 'hidden',
        background: '#fff', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(28,25,23,0.35)',
        display: 'flex', flexDirection: 'column',
        animation: 'scaleIn 0.15s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e7e5e4',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: creative.bg || '#f5f5f4',
            flexShrink: 0,
            border: '1px solid #e7e5e4',
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
              color: '#78716c', fontFamily: '"Geist Mono", monospace', fontWeight: 500,
            }}>execução · {creative.id}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.2 }}>
              Como este criativo foi gerado
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <TraceMetric label="duração" value={(total / 1000).toFixed(1) + 's'}/>
            <TraceMetric label="tokens" value={totalTokens.toLocaleString('pt-BR')}/>
            <TraceMetric label="custo" value={'$' + (totalTokens / 1000 * 0.008).toFixed(3)}/>
            <TraceMetric label="confiança" value={Math.round((creative.confidence || 0.88) * 100) + '%'}/>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent',
            color: '#78716c', cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}>×</button>
        </div>

        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* Graph */}
          <div style={{
            flex: 1, padding: 20, background: '#fafaf9',
            backgroundImage: 'radial-gradient(circle, #eeeceb 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            overflow: 'auto',
          }}>
            <div style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
              <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <defs>
                  <marker id="trArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 Z" fill="oklch(0.55 0.15 145)"/>
                  </marker>
                </defs>
                {edges.map(([from, to], i) => {
                  const a = nodeById[from], b = nodeById[to];
                  const x1 = PAD_X + a.col * COL_W + NODE_W;
                  const y1 = PAD_Y + a.row * ROW_H + NODE_H / 2;
                  const x2 = PAD_X + b.col * COL_W;
                  const y2 = PAD_Y + b.row * ROW_H + NODE_H / 2;
                  const mx = (x1 + x2) / 2;
                  return (
                    <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                      stroke="oklch(0.55 0.15 145 / 0.5)" strokeWidth={1.3} fill="none"
                      markerEnd="url(#trArr)"/>
                  );
                })}
              </svg>

              {stages.map(n => {
                const active = selectedNode === n.id;
                const low = n.confidence < 0.85;
                return (
                  <div key={n.id} onClick={() => setSelectedNode(n.id)} style={{
                    position: 'absolute',
                    left: PAD_X + n.col * COL_W,
                    top: PAD_Y + n.row * ROW_H,
                    width: NODE_W, height: NODE_H,
                    background: '#fff',
                    border: active ? '2px solid oklch(0.55 0.18 25)'
                      : low ? '1px solid oklch(0.7 0.15 55 / 0.6)'
                      : '1px solid oklch(0.55 0.15 145 / 0.4)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    boxShadow: active ? '0 4px 14px oklch(0.55 0.18 25 / 0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
                    cursor: 'pointer', transition: 'all 0.12s',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: low ? 'oklch(0.7 0.15 55)' : 'oklch(0.55 0.15 145)',
                      }}/>
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: '#1c1917',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n.label}</div>
                      <span style={{
                        fontFamily: '"Geist Mono", monospace', fontSize: 9,
                        color: '#78716c', fontVariantNumeric: 'tabular-nums',
                      }}>{((n.end - n.start) / 1000).toFixed(1)}s</span>
                    </div>
                    <div style={{
                      fontSize: 10, color: '#6f6a64',
                      fontFamily: '"Geist Mono", monospace',
                      display: 'flex', justifyContent: 'space-between', gap: 6,
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</span>
                      <span style={{ color: low ? 'oklch(0.55 0.18 55)' : '#78716c', flexShrink: 0 }}>
                        {Math.round(n.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            <div style={{
              marginTop: 20, display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: '"Geist Mono", monospace', fontSize: 10, color: '#78716c',
              maxWidth: W, margin: '20px auto 0',
            }}>
              <span>0s</span>
              <div style={{ flex: 1, height: 22, position: 'relative', background: '#f5f5f4', borderRadius: 4 }}>
                {stages.map((s, i) => (
                  <div key={s.id} title={`${s.label} · ${((s.end - s.start) / 1000).toFixed(1)}s`}
                    style={{
                      position: 'absolute',
                      left: (s.start / total * 100) + '%',
                      width: ((s.end - s.start) / total * 100) + '%',
                      top: 3, height: 16, borderRadius: 3,
                      background: s.confidence < 0.85
                        ? 'oklch(0.7 0.15 55 / 0.5)'
                        : 'oklch(0.55 0.15 145 / 0.35)',
                      borderLeft: '1px solid #fff',
                    }}/>
                ))}
              </div>
              <span>{(total / 1000).toFixed(1)}s</span>
            </div>
          </div>

          {/* Side panel: selected node details OR overall summary */}
          <div style={{
            width: 280, flexShrink: 0, borderLeft: '1px solid #e7e5e4',
            background: '#fff', padding: 18, overflow: 'auto',
          }}>
            {sel ? (
              <>
                <div style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
                  color: '#78716c', fontFamily: '"Geist Mono", monospace', fontWeight: 500,
                }}>node selecionado</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', marginTop: 2 }}>
                  {sel.label}
                </div>

                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  <Row k="Duração" v={((sel.end - sel.start) / 1000).toFixed(2) + 's'}/>
                  <Row k="Início" v={(sel.start / 1000).toFixed(2) + 's'}/>
                  <Row k="Tokens" v={sel.tokens ? sel.tokens.toLocaleString('pt-BR') : '—'}/>
                  <Row k="Confiança" v={Math.round(sel.confidence * 100) + '%'}
                    vColor={sel.confidence < 0.85 ? 'oklch(0.55 0.18 55)' : '#1c1917'}/>
                </div>

                {sel.id === 'copy' && (
                  <div style={{ marginTop: 16 }}>
                    <Label>Saída</Label>
                    <div style={{
                      padding: 10, background: '#fafaf9',
                      border: '1px solid #e7e5e4', borderRadius: 6,
                      fontSize: 12, lineHeight: 1.5, color: '#1c1917',
                    }}>
                      "{creative.headline || 'Sua próxima corrida começa com o passo certo.'}"
                    </div>
                  </div>
                )}

                {sel.id === 'media' && creative.kind !== 'copy' && (
                  <div style={{ marginTop: 16 }}>
                    <Label>Preview</Label>
                    <div style={{
                      aspectRatio: '1', borderRadius: 6,
                      background: creative.bg, border: '1px solid #e7e5e4',
                    }}/>
                  </div>
                )}

                {sel.confidence < 0.85 && (
                  <div style={{
                    marginTop: 16, padding: 10, borderRadius: 6,
                    background: 'oklch(0.96 0.04 55)',
                    border: '1px solid oklch(0.85 0.1 55 / 0.5)',
                    fontSize: 11, color: 'oklch(0.35 0.12 55)', lineHeight: 1.5,
                  }}>
                    <b>Baixa confiança.</b> O validator detectou possível desvio do brand voice neste node. Regenere ou ajuste o briefing.
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
                  color: '#78716c', fontFamily: '"Geist Mono", monospace', fontWeight: 500,
                }}>resumo da execução</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', marginTop: 2 }}>
                  {creative.id} · {creative.kind}
                </div>

                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  <Row k="Modelo" v="gpt-creative v3"/>
                  <Row k="Pipeline" v="creative-std@2.4"/>
                  <Row k="Executado em" v="há 3 min"/>
                  <Row k="run_id" v="7f2a1c"/>
                  <Row k="Seed" v="4821"/>
                </div>

                <div style={{
                  marginTop: 18, padding: 12, borderRadius: 6,
                  background: '#fafaf9', border: '1px solid #e7e5e4',
                  fontSize: 11, color: '#57534e', lineHeight: 1.55,
                }}>
                  Clique em qualquer node para ver tokens, saída, e detalhes daquela etapa.
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button style={traceBtn}>
                    <IconRefresh size={12}/> Re-executar com mesmos inputs
                  </button>
                  <button style={traceBtn}>
                    <IconDownload size={12}/> Exportar trace (.json)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceMetric({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{
        fontSize: 9, color: '#78716c', textTransform: 'uppercase',
        letterSpacing: 0.6, fontFamily: '"Geist Mono", monospace',
      }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: '#1c1917',
        fontFamily: '"Geist Mono", monospace', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

function Row({ k, v, vColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
      <span style={{ color: '#78716c' }}>{k}</span>
      <span style={{
        color: vColor || '#1c1917', fontWeight: 500,
        fontFamily: '"Geist Mono", monospace', fontVariantNumeric: 'tabular-nums',
      }}>{v}</span>
    </div>
  );
}

function Label({ children }) {
  return <div style={{
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
    color: '#78716c', fontFamily: '"Geist Mono", monospace',
    fontWeight: 500, marginBottom: 6,
  }}>{children}</div>;
}

const traceBtn = {
  padding: '7px 10px', borderRadius: 6, fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#fafaf9', border: '1px solid #e7e5e4', color: '#1c1917',
  cursor: 'pointer', fontFamily: 'inherit',
};

Object.assign(window, { GenerationTraceModal });
