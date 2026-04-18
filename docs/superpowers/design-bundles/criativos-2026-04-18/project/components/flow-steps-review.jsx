// Step 3: Review + Export fundidos
// Export antes era tela separada; agora é um painel que abre sobre a revisão.

function FlowReviewExport({ variation, setVariation, onFinish }) {
  const [exportOpen, setExportOpen] = React.useState(false);

  const variants = [
    { id: 'V1', headline: 'Sua próxima corrida começa aqui.',
      body: 'Urban Run X3. Cabedal respirável, amortecimento reativo e design que vai do asfalto ao café.',
      cta: 'Comprar agora', conf: 0.91,
      axes: { relevance: 0.94, originality: 0.82, brandFit: 0.96 },
      selected: true },
    { id: 'V2', headline: 'Menos ruído. Mais passada.',
      body: 'O tênis que entende seu ritmo urbano. Leve, silencioso, afiado.',
      cta: 'Conhecer agora', conf: 0.87,
      axes: { relevance: 0.88, originality: 0.91, brandFit: 0.84 },
      selected: true },
    { id: 'V3', headline: 'Do sofá à meia maratona.',
      body: 'Tecnologia de corrida para quem começou ontem e quer chegar longe.',
      cta: 'Ver linha X3', conf: 0.78,
      axes: { relevance: 0.75, originality: 0.84, brandFit: 0.76 },
      selected: true },
    { id: 'V4', headline: 'Feito para a cidade acordar.',
      body: 'Ruas vazias, fones nos ouvidos, Urban Run X3 nos pés. Combinação perfeita.',
      cta: 'Compre Urban Run', conf: 0.64,
      axes: { relevance: 0.58, originality: 0.91, brandFit: 0.62 },
      selected: false, warn: 'baixa confiança em brand fit' },
    { id: 'V5', headline: 'Corra mais. Pense menos.',
      body: 'Conforto de tecnologia, simplicidade de rotina. Urban Run X3 resolve.',
      cta: 'Experimentar', conf: 0.82,
      axes: { relevance: 0.81, originality: 0.78, brandFit: 0.88 },
      selected: true },
  ];

  const nSel = variants.filter(v => v.selected).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
      {/* Sub-toolbar */}
      <div style={{
        padding: '14px 28px', borderBottom: '1px solid #e7e5e4', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
            color: '#6f6a64', fontWeight: 500,
            fontFamily: '"Geist Mono", monospace',
          }}>etapa 3 · revisão</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1c1917', letterSpacing: -0.2 }}>
            {nSel} de {variants.length} variantes aprovadas
          </div>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'inline-flex', background: '#f5f5f4', borderRadius: 6, padding: 2 }}>
          <div onClick={() => setVariation('grid')} style={segStyle(variation === 'grid')}>⊞ grid</div>
          <div onClick={() => setVariation('stack')} style={segStyle(variation === 'stack')}>☰ comparar</div>
        </div>
        <button style={ghostBtn}>↻ Gerar mais</button>
        <button onClick={() => setExportOpen(true)} style={{
          padding: '7px 14px', borderRadius: 6,
          background: '#1c1917', color: '#fafaf9',
          border: 'none', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          ↗ Enviar para…
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px', background: '#fafaf9' }}>
        {variation === 'grid' ? <ReviewGrid variants={variants}/> : <ReviewStack variants={variants}/>}
      </div>

      {/* Export drawer */}
      {exportOpen && <ExportDrawer onClose={() => setExportOpen(false)} nSel={nSel} onFinish={onFinish}/>}
    </div>
  );
}

function ReviewGrid({ variants }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14,
    }}>
      {variants.map((v, i) => <VariantCard key={v.id} v={v} idx={i}/>)}
    </div>
  );
}

function VariantCard({ v, idx }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      border: `1px solid ${v.selected ? '#1c1917' : '#e7e5e4'}`,
      overflow: 'hidden', position: 'relative',
      animation: `fadeInUp 0.35s ease-out ${idx * 0.05}s backwards`,
      boxShadow: v.selected ? '0 0 0 3px oklch(0.97 0.02 25)' : '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        aspectRatio: '1', background: imgBg(idx),
        position: 'relative', borderBottom: '1px solid #e7e5e4',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: 14,
      }}>
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
          color: idx < 2 ? '#1c1917' : '#fafaf9',
          fontFamily: '"Geist Mono", monospace',
        }}>URBAN RUN</div>
        <div style={{
          position: 'absolute', top: 10, right: 10,
          padding: '3px 7px', borderRadius: 4,
          background: v.selected ? 'oklch(0.55 0.15 145)' : 'rgba(255,255,255,0.9)',
          color: v.selected ? '#fff' : '#44403c', fontSize: 10, fontWeight: 600,
          fontFamily: '"Geist Mono", monospace',
        }}>{v.id}</div>

        <div style={{
          color: idx < 2 ? '#1c1917' : '#fafaf9',
          fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
          lineHeight: 1.2, maxWidth: 200,
          fontFamily: 'Fraunces, serif',
        }}>{v.headline}</div>
        <div style={{
          marginTop: 8, padding: '5px 10px', borderRadius: 4,
          background: idx < 2 ? '#1c1917' : '#fafaf9',
          color: idx < 2 ? '#fafaf9' : '#1c1917',
          fontSize: 10, fontWeight: 600, alignSelf: 'flex-start',
          whiteSpace: 'nowrap',
        }}>{v.cta}</div>
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: '#57534e', lineHeight: 1.5, marginBottom: 10, minHeight: 32 }}>
          {v.body}
        </div>
        <ConfidenceSignal conf={v.conf} axes={v.axes}/>
        {v.warn && (
          <div style={{
            marginTop: 8, padding: '6px 8px', borderRadius: 4,
            background: 'oklch(0.97 0.04 60)', color: 'oklch(0.4 0.15 60)',
            fontSize: 10, display: 'flex', gap: 6, alignItems: 'center',
            fontFamily: '"Geist Mono", monospace',
          }}>⚠ {v.warn}</div>
        )}
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #e7e5e4' }}>
        <div style={{
          flex: 1, padding: '9px 0', textAlign: 'center', fontSize: 11, fontWeight: 500,
          color: v.selected ? 'oklch(0.55 0.15 145)' : '#78716c',
          cursor: 'pointer',
        }}>{v.selected ? '✓ aprovada' : '+ aprovar'}</div>
        <div style={{ width: 1, background: '#e7e5e4' }}/>
        <div style={{
          flex: 1, padding: '9px 0', textAlign: 'center', fontSize: 11,
          color: '#78716c', cursor: 'pointer',
        }}>editar</div>
      </div>
    </div>
  );
}

function ConfidenceSignal({ conf, axes }) {
  const color = conf >= 0.8 ? 'oklch(0.55 0.15 145)' : conf >= 0.7 ? 'oklch(0.7 0.15 80)' : 'oklch(0.6 0.2 25)';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color, fontFamily: '"Geist Mono", monospace' }}>
          {conf.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: '#6f6a64', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 500 }}>
          confidence
        </div>
        {conf < 0.7 && (
          <div style={{
            padding: '1px 5px', borderRadius: 4,
            background: 'oklch(0.95 0.06 25)', color: 'oklch(0.5 0.2 25)',
            fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
            fontFamily: '"Geist Mono", monospace',
          }}>LOW</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
        <Bar v={axes.relevance} label="rel"/>
        <Bar v={axes.originality} label="orig"/>
        <Bar v={axes.brandFit} label="brand"/>
      </div>
    </div>
  );
}

function Bar({ v, label }) {
  const color = v >= 0.8 ? 'oklch(0.55 0.15 145)' : v >= 0.7 ? 'oklch(0.7 0.15 80)' : 'oklch(0.6 0.2 25)';
  return (
    <div style={{ flex: 1 }}>
      <div style={{ height: 4, background: '#f5f5f4', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${v * 100}%`, height: '100%', background: color }}/>
      </div>
      <div style={{ fontSize: 10, color: '#6f6a64', marginTop: 2, textAlign: 'center',
        fontFamily: '"Geist Mono", monospace' }}>{label}</div>
    </div>
  );
}

function ReviewStack({ variants }) {
  const fields = ['headline', 'body', 'cta', 'conf'];
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e7e5e4', overflow: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `120px repeat(${variants.length}, 1fr)`,
        borderBottom: '1px solid #e7e5e4', background: '#fafaf9',
      }}>
        <div style={{ padding: '10px 14px', fontSize: 10, color: '#6f6a64',
          fontFamily: '"Geist Mono", monospace', textTransform: 'uppercase', letterSpacing: 0.5 }}>campo</div>
        {variants.map(v => (
          <div key={v.id} style={{
            padding: '10px 14px', borderLeft: '1px solid #e7e5e4',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              padding: '2px 6px', borderRadius: 4,
              background: v.selected ? 'oklch(0.55 0.15 145)' : '#e7e5e4',
              color: v.selected ? '#fff' : '#78716c', fontSize: 10, fontWeight: 600,
              fontFamily: '"Geist Mono", monospace',
            }}>{v.id}</div>
            <div style={{
              fontSize: 11, fontFamily: '"Geist Mono", monospace',
              color: v.conf >= 0.8 ? 'oklch(0.45 0.15 145)' : v.conf >= 0.7 ? 'oklch(0.5 0.15 80)' : 'oklch(0.5 0.2 25)',
            }}>{v.conf.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {fields.map((f, fi) => (
        <div key={f} style={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${variants.length}, 1fr)`,
          borderBottom: fi < fields.length - 1 ? '1px solid #f5f5f4' : 'none',
        }}>
          <div style={{
            padding: '14px', fontSize: 10, color: '#78716c',
            fontFamily: '"Geist Mono", monospace', textTransform: 'uppercase', letterSpacing: 0.5,
            background: '#fafaf9',
          }}>{f}</div>
          {variants.map((v, vi) => {
            const val = f === 'conf' ? v.conf.toFixed(2) : v[f];
            const isBase = vi === 0;
            return (
              <div key={v.id} style={{
                padding: '14px', borderLeft: '1px solid #f5f5f4',
                fontSize: f === 'headline' ? 13 : 11,
                fontFamily: f === 'headline' ? 'Fraunces, serif' : 'inherit',
                fontWeight: f === 'headline' ? 600 : 400,
                color: '#1c1917', lineHeight: 1.45,
                background: !isBase && f !== 'conf' ? 'linear-gradient(90deg, transparent 0%, oklch(0.97 0.02 80 / 0.4) 100%)' : 'transparent',
              }}>{val}</div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Export Drawer (replaces old Export step) ─────
function ExportDrawer({ onClose, nSel, onFinish }) {
  const [state, setState] = React.useState('idle'); // idle | rendering | done
  const [dest, setDest] = React.useState(null);

  React.useEffect(() => {
    if (state !== 'rendering') return;
    const t = setTimeout(() => setState('done'), 2400);
    return () => clearTimeout(t);
  }, [state]);

  const destinations = [
    { id: 'zip', icon: '↓', name: 'Baixar ZIP', sub: `${nSel * 3} arquivos · ~36 MB` },
    { id: 'meta', icon: 'M', name: 'Meta Ads Manager', sub: 'publicar como rascunho' },
    { id: 'drive', icon: '☁', name: 'Google Drive', sub: '/Urban Run/Campanhas/Q1' },
    { id: 'figma', icon: 'F', name: 'Figma', sub: 'abrir como frames' },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(28, 25, 23, 0.3)',
      display: 'flex', justifyContent: 'flex-end',
      animation: 'fadeInUp 0.15s ease-out',
      zIndex: 10,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 400, background: '#fafaf9',
        borderLeft: '1px solid #e7e5e4',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.05)',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #e7e5e4',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
              color: '#6f6a64', fontWeight: 500,
              fontFamily: '"Geist Mono", monospace',
            }}>enviar</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.2 }}>
              {state === 'done' ? 'Pronto' : `${nSel} variantes × 3 formatos`}
            </div>
          </div>
          <div onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: '#78716c', fontSize: 16,
          }}>×</div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          {state === 'idle' && (
            <>
              <div style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
                color: '#6f6a64', fontWeight: 500, marginBottom: 10,
                fontFamily: '"Geist Mono", monospace',
              }}>escolha um destino</div>
              {destinations.map(d => (
                <div key={d.id} onClick={() => { setDest(d); setState('rendering'); }} style={{
                  padding: 14, marginBottom: 8, borderRadius: 8,
                  background: '#fff', border: '1px solid #e7e5e4',
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#1c1917'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e7e5e4'}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: '#f5f5f4', color: '#44403c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600,
                    fontFamily: '"Geist Mono", monospace',
                  }}>{d.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{
                      fontSize: 11, color: '#6f6a64', marginTop: 2,
                      fontFamily: '"Geist Mono", monospace',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{d.sub}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#a8a29e' }}>→</div>
                </div>
              ))}
            </>
          )}

          {state === 'rendering' && dest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
              <div style={{
                padding: 16, background: '#fff', borderRadius: 10,
                border: '1px solid #e7e5e4',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: '#1c1917', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600,
                    fontFamily: '"Geist Mono", monospace',
                  }}>{dest.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1917' }}>
                      Renderizando & enviando
                    </div>
                    <div style={{ fontSize: 11, color: '#6f6a64',
                      fontFamily: '"Geist Mono", monospace' }}>
                      destino: {dest.name.toLowerCase()}
                    </div>
                  </div>
                </div>
                <div style={{ height: 5, background: '#f5f5f4', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: '67%',
                    background: 'linear-gradient(90deg, oklch(0.55 0.18 25), oklch(0.65 0.18 25))',
                    borderRadius: 4,
                    animation: 'pulse 1.6s ease-in-out infinite',
                  }}/>
                </div>
                <div style={{
                  marginTop: 10, fontSize: 10, color: '#6f6a64',
                  fontFamily: '"Geist Mono", monospace',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{Math.round(nSel * 3 * 0.67)} de {nSel * 3}</span>
                  <span>~3s · 4 workers</span>
                </div>
              </div>

              <MiniRenderGrid nSel={nSel}/>
            </div>
          )}

          {state === 'done' && dest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
              <div style={{
                padding: 16, background: 'oklch(0.97 0.03 145)',
                borderRadius: 10, border: '1px solid oklch(0.88 0.08 145)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'oklch(0.55 0.15 145)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><IconCheck size={16}/></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.3 0.15 145)' }}>
                    {nSel * 3} arquivos enviados
                  </div>
                  <div style={{ fontSize: 11, color: 'oklch(0.4 0.1 145)',
                    fontFamily: '"Geist Mono", monospace' }}>
                    {dest.name.toLowerCase()} · 8.4s · 36 MB
                  </div>
                </div>
              </div>

              <MiniRenderGrid nSel={nSel} done/>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={onFinish} style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: '#1c1917', color: '#fafaf9',
                  border: 'none', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  cursor: 'pointer',
                }}>Concluir fluxo</button>
                <button onClick={() => { setState('idle'); setDest(null); }} style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: '#fff', color: '#44403c',
                  border: '1px solid #e7e5e4', fontSize: 12, fontFamily: 'inherit',
                  cursor: 'pointer',
                }}>Enviar para outro destino</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniRenderGrid({ nSel, done }) {
  const tiles = [];
  for (let v = 0; v < nSel; v++) {
    for (let f = 0; f < 3; f++) {
      tiles.push({ idx: v * 3 + f, v, f, done: done || (v * 3 + f) < Math.round(nSel * 3 * 0.67) });
    }
  }
  const bgs = [
    'linear-gradient(135deg, #fed7aa, #fb923c)',
    'linear-gradient(135deg, #fef3c7, #fbbf24)',
    'linear-gradient(135deg, #1c1917, #44403c)',
    'linear-gradient(135deg, #292524, #57534e)',
  ];
  return (
    <div>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
        color: '#6f6a64', fontWeight: 500, marginBottom: 8,
        fontFamily: '"Geist Mono", monospace',
      }}>{done ? 'arquivos' : 'renderizando'}</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
      }}>
        {tiles.map(t => (
          <div key={t.idx} style={{
            aspectRatio: '1', borderRadius: 4, overflow: 'hidden',
            border: '1px solid #e7e5e4', position: 'relative',
            background: t.done ? bgs[t.v % 4] : '#f5f5f4',
            opacity: t.done ? 1 : 0.55,
          }}>
            {!t.done && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                animation: 'shimmer 1.5s infinite',
              }}/>
            )}
            {t.done && (
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 10, height: 10, borderRadius: '50%',
                background: 'oklch(0.55 0.15 145)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7,
              }}>✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function segStyle(active) {
  return {
    padding: '5px 11px', borderRadius: 4, fontSize: 11,
    fontFamily: '"Geist Mono", monospace', cursor: 'pointer',
    whiteSpace: 'nowrap',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1c1917' : '#78716c',
    fontWeight: active ? 500 : 400,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
  };
}

const ghostBtn = {
  padding: '6px 12px', borderRadius: 6,
  background: '#fff', color: '#44403c',
  border: '1px solid #e7e5e4', fontSize: 11,
  fontFamily: 'inherit', cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function imgBg(i) {
  return [
    'linear-gradient(135deg, #fed7aa, #fb923c)',
    'linear-gradient(135deg, #fef3c7, #fbbf24)',
    'linear-gradient(135deg, #1c1917, #44403c)',
    'linear-gradient(135deg, #292524, #57534e)',
    'linear-gradient(135deg, #fafaf9, #d6d3d1)',
  ][i % 5];
}

Object.assign(window, { FlowReviewExport });
