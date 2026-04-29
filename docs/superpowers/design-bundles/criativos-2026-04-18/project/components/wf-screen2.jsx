// SCREEN 2: Brief editor + methodology selector

function Screen2Brief({ state }) {
  const methods = [
    { id: 'aida', name: 'AIDA', sub: 'Atenção → Interesse → Desejo → Ação', selected: true },
    { id: 'pas',  name: 'PAS',  sub: 'Problem → Agitate → Solve' },
    { id: 'bab',  name: 'BAB',  sub: 'Before → After → Bridge' },
    { id: 'custom', name: 'Custom', sub: 'Defina seu próprio framework' },
  ];

  return (
    <>
      <WfTopNav step={1}/>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Main */}
        <div style={{ flex: 1, padding: '24px 28px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <WfLabel>etapa 2 de 5</WfLabel>
            <div style={{ fontSize: 20, fontWeight: 600, color: WF_C.ink, letterSpacing: -0.3 }}>
              Defina o briefing
            </div>
          </div>

          <div>
            <WfLabel>produto / serviço</WfLabel>
            <WfBox style={{ padding: '10px 12px', fontSize: 13, color: WF_C.text }}>
              Tênis Urban Run X3 — linha leve para corrida urbana
            </WfBox>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <WfLabel>objetivo</WfLabel>
              <WfBox style={{ padding: '10px 12px', fontSize: 13, color: WF_C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                Conversão · vendas
                <div style={{ flex: 1 }}/>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={WF_C.dim} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </WfBox>
            </div>
            <div>
              <WfLabel>orçamento diário</WfLabel>
              <WfBox style={{ padding: '10px 12px', fontSize: 13, color: WF_C.text, fontFamily: wfFonts.mono }}>
                R$ 240,00
              </WfBox>
            </div>
          </div>

          <div>
            <WfLabel>público-alvo</WfLabel>
            <WfBox style={{ padding: '12px', fontSize: 13, color: WF_C.text, lineHeight: 1.55 }}>
              Adultos 22–38 anos, urbanos, praticantes de corrida casual 1–3× por semana. Interessados em wellness, moda esportiva, tecnologia. São Paulo, Rio, BH, Curitiba.
            </WfBox>
          </div>

          <div>
            <WfLabel>tom de voz</WfLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Energético', 'Confiante', 'Direto', 'Inspiracional'].map((t, i) => (
                <WfChip key={t} variant={i < 2 ? 'dark' : 'default'}>{t}</WfChip>
              ))}
              <WfChip variant="default">+ adicionar</WfChip>
            </div>
          </div>

          <div>
            <WfLabel>metodologia de copywriting <span style={{ color: WF_C.accent }}>★</span></WfLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {methods.map(m => (
                <WfBox key={m.id} style={{
                  padding: 12, cursor: 'pointer',
                  border: `1px solid ${m.selected ? WF_C.ink : WF_C.line}`,
                  background: m.selected ? '#fafafa' : '#fff',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: `2px solid ${m.selected ? WF_C.ink : WF_C.line}`,
                      background: m.selected ? WF_C.ink : 'transparent',
                      position: 'relative',
                    }}>
                      {m.selected && <div style={{
                        position: 'absolute', inset: 3, background: '#fff', borderRadius: '50%',
                      }}/>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: WF_C.ink, fontFamily: wfFonts.mono }}>
                      {m.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: WF_C.muted, marginTop: 5, marginLeft: 22 }}>
                    {m.sub}
                  </div>
                </WfBox>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <WfLabel>nº de variantes</WfLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                {[3, 5, 8, 12].map(n => (
                  <div key={n} style={{
                    flex: 1, padding: '8px 0', textAlign: 'center',
                    fontFamily: wfFonts.mono, fontSize: 12,
                    border: `1px solid ${n === 5 ? WF_C.ink : WF_C.line}`,
                    background: n === 5 ? WF_C.ink : '#fff',
                    color: n === 5 ? '#fff' : WF_C.text,
                    borderRadius: 4, cursor: 'pointer',
                  }}>{n}</div>
                ))}
              </div>
            </div>
            <div>
              <WfLabel>formatos</WfLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['1:1', '9:16', '4:5', '16:9'].map((f, i) => (
                  <WfChip key={f} variant={i < 3 ? 'dark' : 'default'}>{f}</WfChip>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Side: prompt preview */}
        <div style={{
          width: 200, flexShrink: 0, padding: '24px 16px',
          borderLeft: `1px solid ${WF_C.softline}`,
          background: WF_C.bg,
          fontSize: 10, fontFamily: wfFonts.mono, color: WF_C.muted,
          lineHeight: 1.5, overflow: 'auto',
        }}>
          <WfLabel>prompt preview</WfLabel>
          <div style={{ color: WF_C.dim }}>system:</div>
          <div>você é um copywriter sênior especializado em meta ads…</div>
          <div style={{ color: WF_C.dim, marginTop: 8 }}>user:</div>
          <div>produto: Tênis Urban Run X3</div>
          <div>método: AIDA</div>
          <div>público: 22-38 urbanos</div>
          <div>tom: [energético, confiante]</div>
          <div>formatos: [1:1, 9:16, 4:5]</div>
          <div>n_variantes: 5</div>
          <div style={{ marginTop: 8, color: WF_C.dim }}># dry-run disponível</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px', borderTop: `1px solid ${WF_C.softline}` }}>
        <WfBtn label="← Voltar" ghost/>
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: WF_C.muted, fontFamily: wfFonts.mono }}>
          custo estimado: 5 variantes × 3 formatos = <b style={{ color: WF_C.ink }}>15 créditos</b>
        </div>
        <WfBtn label="Dry-run" ghost hint="⌘⇧↵"/>
        <WfBtn label={state === 'dry-run' ? 'Simular geração' : 'Gerar criativos →'} primary hint="⌘↵"/>
      </div>
    </>
  );
}

Object.assign(window, { Screen2Brief });
