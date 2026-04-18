// SCREEN 4: Review variants (2 variations: grid / stack)
// SCREEN 5: Batch render + download

function Screen4Review({ state, variation, onVar }) {
  // 5 variants with varying confidence
  const variants = [
    { id: 'V1', headline: 'Sua próxima corrida começa aqui.', body: 'Urban Run X3. Cabedal respirável, entressola reativa.',
      cta: 'Comprar agora', score: 0.91, axes: { rel: 0.93, orig: 0.82, brand: 0.98 } },
    { id: 'V2', headline: 'Menos ruído. Mais passada.', body: 'Leve como uma decisão rápida.',
      cta: 'Comprar agora', score: 0.88, axes: { rel: 0.85, orig: 0.91, brand: 0.88 } },
    { id: 'V3', headline: 'Do sofá à meia maratona.', body: 'Seis semanas, três corridas por semana, um tênis que acompanha.',
      cta: 'Começar agora', score: 0.82, axes: { rel: 0.78, orig: 0.88, brand: 0.8 } },
    { id: 'V4', headline: 'Ritmo novo, tênis novo, você novo.', body: 'Coleção de verão com 15% off na primeira semana.',
      cta: 'Aproveitar', score: 0.64, axes: { rel: 0.72, orig: 0.45, brand: 0.74 }, flag: 'baixa originalidade · clichê detectado' },
    { id: 'V5', headline: 'Projetado no asfalto, testado no seu dia.', body: 'Avaliação 4.8 de 2.341 corredores.',
      cta: 'Conhecer', score: 0.87, axes: { rel: 0.9, orig: 0.81, brand: 0.9 } },
  ];

  const isEmpty = state === 'empty';
  const isStack = variation === 'stack';

  return (
    <>
      <WfTopNav step={3}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          padding: '16px 24px 12px', borderBottom: `1px solid ${WF_C.softline}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: WF_C.ink, letterSpacing: -0.3 }}>
              Revise 5 variantes
            </div>
            <div style={{ fontSize: 11, color: WF_C.muted, marginTop: 2, fontFamily: wfFonts.mono }}>
              ordenadas por confidence · clique para comparar
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'inline-flex', background: WF_C.chip, borderRadius: 4, padding: 2 }}>
            <div onClick={() => onVar && onVar('grid')} style={{
              fontFamily: wfFonts.mono, fontSize: 10, padding: '4px 9px', borderRadius: 3, cursor: 'pointer',
              background: variation === 'grid' ? '#fff' : 'transparent',
              color: variation === 'grid' ? WF_C.ink : WF_C.muted,
              fontWeight: variation === 'grid' ? 500 : 400,
              boxShadow: variation === 'grid' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>var A · grid</div>
            <div onClick={() => onVar && onVar('stack')} style={{
              fontFamily: wfFonts.mono, fontSize: 10, padding: '4px 9px', borderRadius: 3, cursor: 'pointer',
              background: variation === 'stack' ? '#fff' : 'transparent',
              color: variation === 'stack' ? WF_C.ink : WF_C.muted,
              fontWeight: variation === 'stack' ? 500 : 400,
              boxShadow: variation === 'stack' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>var B · stack</div>
          </div>
          <WfBtn label="↻ Gerar mais" ghost size="sm"/>
          <WfBtn label="Renderizar PNGs →" primary size="sm"/>
        </div>

        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ textAlign: 'center', maxWidth: 320 }}>
              <div style={{
                width: 48, height: 48, margin: '0 auto 16px',
                border: `1.5px dashed ${WF_C.line}`, borderRadius: '50%',
              }}/>
              <div style={{ fontSize: 14, fontWeight: 500, color: WF_C.ink, marginBottom: 6 }}>
                Sem variantes ainda
              </div>
              <div style={{ fontSize: 12, color: WF_C.muted, lineHeight: 1.5, marginBottom: 16 }}>
                Complete o briefing e execute a geração para ver as variantes aparecerem aqui.
              </div>
              <WfBtn label="Voltar ao briefing" primary size="sm"/>
            </div>
          </div>
        ) : isStack ? (
          <StackCompare variants={variants}/>
        ) : (
          <div style={{
            flex: 1, overflow: 'auto', padding: 20,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}>
              {variants.map((v, i) => (
                <VariantCard key={v.id} v={v} idx={i}/>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function VariantCard({ v, idx }) {
  const low = v.score < 0.7;
  return (
    <WfBox style={{
      padding: 0, overflow: 'hidden',
      borderColor: low ? 'oklch(0.85 0.1 60)' : WF_C.line,
    }}>
      {/* Preview */}
      <div style={{
        aspectRatio: '1', background: `linear-gradient(135deg, ${['#fed7aa','#1c1917','#292524','#fef3c7','#fafaf9'][idx]}, ${['#fb923c','#44403c','#57534e','#fbbf24','#e7e5e4'][idx]})`,
        display: 'flex', alignItems: 'flex-end', padding: 14, position: 'relative',
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.2,
          color: idx === 4 ? WF_C.ink : '#fff',
          textShadow: idx === 4 ? 'none' : '0 1px 4px rgba(0,0,0,0.3)',
        }}>{v.headline}</div>
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontFamily: wfFonts.mono, fontSize: 10,
          padding: '2px 6px', borderRadius: 3,
          background: 'rgba(0,0,0,0.5)', color: '#fff',
        }}>{v.id}</div>
        {low && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            fontFamily: wfFonts.mono, fontSize: 10, fontWeight: 600,
            padding: '2px 6px', borderRadius: 3,
            background: '#fff', color: WF_C.warn,
            border: `1px solid ${WF_C.warn}`,
          }}>LOW CONF</div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: WF_C.text, lineHeight: 1.45 }}>{v.body}</div>

        {/* Confidence score + bar */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.dim }}>confidence</span>
            <span style={{
              fontFamily: wfFonts.mono, fontSize: 12, fontWeight: 600,
              color: low ? WF_C.warn : WF_C.ink,
            }}>{v.score.toFixed(2)}</span>
            <div style={{ flex: 1 }}/>
            <AxesMini axes={v.axes}/>
          </div>
          <div style={{
            height: 4, background: WF_C.chip, borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${v.score * 100}%`, height: '100%',
              background: low ? WF_C.warn : WF_C.ink,
            }}/>
          </div>
          {v.flag && (
            <div style={{
              marginTop: 6, fontSize: 10, color: WF_C.warn,
              fontFamily: wfFonts.mono,
            }}>⚠ {v.flag}</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', borderTop: `1px dashed ${WF_C.softline}`, paddingTop: 10 }}>
          <WfChip variant="default">{v.cta}</WfChip>
          <div style={{ flex: 1 }}/>
          <div style={{ fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.dim, cursor: 'pointer' }}>
            ↗ trace
          </div>
          <div style={{ fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.dim, cursor: 'pointer' }}>
            ↻ regerar
          </div>
        </div>
      </div>
    </WfBox>
  );
}

function AxesMini({ axes }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
      {Object.entries(axes).map(([k, v]) => (
        <div key={k} title={k} style={{
          width: 4, height: 12, background: WF_C.chip, borderRadius: 1, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${v * 100}%`, background: v < 0.7 ? WF_C.warn : WF_C.ink,
          }}/>
        </div>
      ))}
    </div>
  );
}

function StackCompare({ variants }) {
  const top = variants.slice(0, 3);
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `80px repeat(${top.length}, 1fr)`,
        gap: 0, fontSize: 12,
      }}>
        <div/>
        {top.map(v => (
          <div key={v.id} style={{
            padding: '8px 12px', fontFamily: wfFonts.mono, fontSize: 11,
            color: WF_C.ink, borderBottom: `1px solid ${WF_C.line}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {v.id} <span style={{ color: WF_C.muted }}>· {v.score.toFixed(2)}</span>
          </div>
        ))}

        {['Headline', 'Body', 'CTA'].map(field => (
          <React.Fragment key={field}>
            <div style={{
              padding: '12px 0', fontFamily: wfFonts.mono, fontSize: 10,
              color: WF_C.dim, textTransform: 'uppercase', letterSpacing: 0.8,
              borderBottom: `1px dashed ${WF_C.softline}`,
            }}>{field}</div>
            {top.map(v => {
              const text = field === 'Headline' ? v.headline : field === 'Body' ? v.body : v.cta;
              return (
                <div key={v.id} style={{
                  padding: '12px 14px 12px 0',
                  borderBottom: `1px dashed ${WF_C.softline}`,
                  borderLeft: `1px solid ${WF_C.softline}`,
                  paddingLeft: 14,
                  fontSize: field === 'Headline' ? 14 : 12,
                  fontWeight: field === 'Headline' ? 600 : 400,
                  color: WF_C.text, lineHeight: 1.4,
                }}>
                  <HighlightDiff text={text}/>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: '10px 14px', fontSize: 11,
        color: WF_C.muted, background: WF_C.bg,
        border: `1px dashed ${WF_C.line}`, borderRadius: 4,
      }}>
        💡 palavras destacadas indicam divergência entre as variantes. Passe o mouse em qualquer headline para ver análise semântica.
      </div>
    </div>
  );
}

function HighlightDiff({ text }) {
  // Naive visual diff — highlight first 2 distinctive words
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => {
        const hl = [1, 3].includes(i);
        return (
          <span key={i} style={{
            background: hl ? 'oklch(0.95 0.04 25)' : 'transparent',
            padding: hl ? '0 2px' : 0, borderRadius: 2,
          }}>{w}{' '}</span>
        );
      })}
    </>
  );
}

// ─── SCREEN 5: Batch render + download ────────────────
function Screen5Export({ state }) {
  const renders = [];
  for (let v = 1; v <= 5; v++) {
    for (const f of ['1:1', '9:16', '4:5']) {
      const i = renders.length;
      renders.push({
        id: `V${v}_${f}`,
        variant: `V${v}`,
        format: f,
        status: state === 'rendering' ? (i < 8 ? 'done' : i < 10 ? 'active' : 'queued')
          : state === 'done' ? 'done'
          : 'queued',
      });
    }
  }
  const doneCount = renders.filter(r => r.status === 'done').length;
  const total = renders.length;

  return (
    <>
      <WfTopNav step={4}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          padding: '16px 24px', borderBottom: `1px solid ${WF_C.softline}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: WF_C.ink, letterSpacing: -0.3 }}>
              Renderizar PNGs
            </div>
            <div style={{ fontSize: 11, color: WF_C.muted, marginTop: 2, fontFamily: wfFonts.mono }}>
              {doneCount}/{total} renders · {state === 'done' ? 'pronto para download' : state === 'rendering' ? 'processando em paralelo' : 'aguardando'}
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <WfChip variant="default">1080px · png · sRGB</WfChip>
          <WfBtn label="Config" ghost size="sm"/>
          <WfBtn label={state === 'done' ? '⬇ Baixar .zip' : 'Renderizando…'} primary size="sm" style={{ opacity: state === 'done' ? 1 : 0.6 }}/>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${WF_C.softline}` }}>
          <div style={{
            height: 4, background: WF_C.chip, borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${(doneCount / total) * 100}%`, height: '100%',
              background: state === 'done' ? WF_C.ok : WF_C.accent,
              transition: 'width 0.3s',
            }}/>
          </div>
          <div style={{
            display: 'flex', marginTop: 6, fontSize: 11, color: WF_C.muted,
            fontFamily: wfFonts.mono,
          }}>
            <span>{state === 'rendering' ? `ETA ~${Math.max(0, total - doneCount) * 2}s` : state === 'done' ? 'concluído em 38s' : 'pronto para iniciar'}</span>
            <div style={{ flex: 1 }}/>
            <span>4 workers · GPU accelerated</span>
          </div>
        </div>

        {/* Render grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
          }}>
            {renders.map((r, i) => (
              <RenderTile key={r.id} r={r} idx={i}/>
            ))}
          </div>
        </div>

        {/* Export options */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${WF_C.softline}`,
          background: WF_C.bg,
          display: 'flex', gap: 12, alignItems: 'center', fontSize: 11,
        }}>
          <span style={{ color: WF_C.muted, fontFamily: wfFonts.mono }}>exportar para:</span>
          {['Meta Ads Manager', 'Google Drive', 'Dropbox', 'Figma', '.zip local'].map((t, i) => (
            <WfChip key={t} variant={i === 4 ? 'dark' : 'default'}>{t}</WfChip>
          ))}
          <div style={{ flex: 1 }}/>
          <span style={{ color: WF_C.dim, fontFamily: wfFonts.mono }}>inclui: PNGs · copy.csv · trace.json</span>
        </div>
      </div>
    </>
  );
}

function RenderTile({ r, idx }) {
  const bgs = [
    'linear-gradient(135deg,#fed7aa,#fb923c)',
    'linear-gradient(135deg,#1c1917,#44403c)',
    'linear-gradient(135deg,#292524,#78716c)',
    'linear-gradient(135deg,#fef3c7,#fbbf24)',
    'linear-gradient(135deg,#fafaf9,#e7e5e4)',
  ];
  const bg = bgs[Math.floor(idx / 3) % bgs.length];
  const aspect = r.format === '9:16' ? '9/16' : r.format === '4:5' ? '4/5' : '1/1';

  return (
    <WfBox style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        aspectRatio: aspect, background: r.status === 'queued' ? WF_C.chip : bg,
        position: 'relative', overflow: 'hidden',
      }}>
        {r.status === 'active' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
            animation: 'shimmer 1.5s infinite',
          }}/>
        )}
        {r.status === 'queued' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: WF_C.dim, fontFamily: wfFonts.mono, fontSize: 10,
          }}>queued</div>
        )}
        {r.status === 'done' && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 14, height: 14, borderRadius: '50%',
            background: WF_C.ok, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8,
          }}>✓</div>
        )}
      </div>
      <div style={{
        padding: '4px 8px', fontFamily: wfFonts.mono, fontSize: 9,
        color: WF_C.muted, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{r.id}</span>
        <span>{r.status === 'done' ? '2.4MB' : '—'}</span>
      </div>
    </WfBox>
  );
}

Object.assign(window, { Screen4Review, Screen5Export });
