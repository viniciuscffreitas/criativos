// Screen 1: Upload (empty / dragover / filled states)

function WfTopNav({ step }) {
  const steps = ['Upload', 'Brief', 'Geração', 'Revisão', 'Export'];
  return (
    <div style={{
      padding: '12px 20px', borderBottom: `1px solid ${WF_C.softline}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        fontFamily: wfFonts.ui, fontSize: 13, fontWeight: 600, color: WF_C.ink,
      }}>Criativos</div>
      <WfChip variant="default">v3.0 · projeto: Urban Run</WfChip>
      <div style={{ flex: 1 }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <div style={{ width: 8, height: 1, background: WF_C.line }}/>}
            <div style={{
              fontFamily: wfFonts.mono, fontSize: 10,
              padding: '3px 7px', borderRadius: 3,
              background: i === step ? WF_C.ink : 'transparent',
              color: i === step ? '#fff' : i < step ? WF_C.text : WF_C.dim,
              border: i < step ? `1px solid ${WF_C.line}` : i === step ? 'none' : `1px dashed ${WF_C.line}`,
            }}>{String(i+1).padStart(2,'0')} {s}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── SCREEN 1: UPLOAD ────────────────────────────────────
function Screen1Upload({ state }) {
  return (
    <>
      <WfTopNav step={0}/>
      <div style={{ flex: 1, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <WfLabel>etapa 1 de 5</WfLabel>
          <div style={{ fontSize: 22, fontWeight: 600, color: WF_C.ink, letterSpacing: -0.3 }}>
            Envie os ativos da marca
          </div>
          <div style={{ fontSize: 13, color: WF_C.muted, marginTop: 4, maxWidth: 400 }}>
            Logos, fotos de produto, paleta. O agente usa estes ativos para gerar criativos consistentes com a identidade.
          </div>
        </div>

        {/* Drop zone */}
        <div style={{
          border: `2px ${state === 'dragover' ? 'solid' : 'dashed'} ${state === 'dragover' ? WF_C.accent : WF_C.line}`,
          borderRadius: 6, padding: 32,
          background: state === 'dragover' ? 'oklch(0.97 0.02 25)' : state === 'filled' ? WF_C.surface : WF_C.bg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          textAlign: 'center',
        }}>
          {state === 'empty' && (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: `1.5px dashed ${WF_C.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: WF_C.dim,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, color: WF_C.text, fontWeight: 500 }}>
                Arraste arquivos aqui ou <span style={{ color: WF_C.accent, textDecoration: 'underline' }}>escolha do computador</span>
              </div>
              <div style={{ fontSize: 11, color: WF_C.dim, fontFamily: wfFonts.mono }}>
                png · jpg · webp · svg · pdf · mp4 · até 50MB cada
              </div>
            </>
          )}
          {state === 'dragover' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 500, color: WF_C.accent }}>
                Solte para enviar 8 arquivos
              </div>
              <div style={{ fontSize: 11, color: WF_C.muted, fontFamily: wfFonts.mono }}>
                detectando: 3× png · 2× jpg · 1× svg · 2× mp4
              </div>
            </>
          )}
          {state === 'filled' && (
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {Array.from({length: 8}).map((_, i) => (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 4, background: WF_C.chip,
                  border: `1px solid ${WF_C.softline}`, position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '2px 4px', background: 'rgba(0,0,0,0.6)',
                    color: '#fff', fontFamily: wfFonts.mono, fontSize: 8,
                  }}>IMG_{String(i+1).padStart(2,'0')}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hints */}
        <div>
          <WfLabel>ativos recomendados</WfLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Logo (svg ou png transparente)', ok: state === 'filled' },
              { label: '3+ fotos de produto', ok: state === 'filled' },
              { label: 'Paleta de cores (opcional)', ok: false },
              { label: 'Guia de marca (pdf)', ok: false },
            ].map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', border: `1px solid ${WF_C.softline}`,
                borderRadius: 4, fontSize: 11, color: WF_C.muted,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: h.ok ? WF_C.ok : 'transparent',
                  border: `1px solid ${h.ok ? WF_C.ok : WF_C.line}`,
                }}/>
                {h.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}/>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          paddingTop: 16, borderTop: `1px solid ${WF_C.softline}` }}>
          <div style={{ fontSize: 12, color: WF_C.muted, fontFamily: wfFonts.mono }}>
            {state === 'filled' ? '8 arquivos · 12.4 MB' : '0 arquivos'}
          </div>
          <div style={{ flex: 1 }}/>
          <WfBtn label="Pular" ghost/>
          <WfBtn label="Continuar →" primary style={{ opacity: state === 'filled' ? 1 : 0.4 }} hint="↵"/>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Screen1Upload, WfTopNav });
