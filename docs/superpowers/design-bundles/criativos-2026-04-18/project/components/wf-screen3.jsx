// SCREEN 3: Generation — trace streaming with multiple states

function Screen3Generation({ state }) {
  return (
    <>
      <WfTopNav step={2}/>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: progress */}
        <div style={{ width: 220, flexShrink: 0, padding: '20px 16px',
          borderRight: `1px solid ${WF_C.softline}`, background: WF_C.bg }}>
          <WfLabel>pipeline</WfLabel>
          {[
            { label: 'Parse brief', status: 'done' },
            { label: 'Prompt build', status: 'done' },
            { label: 'Gerar variantes (LLM)', status: state === 'error-json' ? 'error' : state === 'streaming' ? 'active' : state === 'rate-limit' ? 'error' : 'done' },
            { label: 'Validar JSON', status: state === 'error-json' ? 'error' : state === 'streaming' ? 'queued' : 'done' },
            { label: 'Render PNG', status: state === 'streaming' || state === 'error-json' || state === 'rate-limit' ? 'queued' : 'done' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', alignItems: 'center' }}>
              <StepDot status={s.status}/>
              <div style={{ fontSize: 12, color: s.status === 'queued' ? WF_C.dim : WF_C.text,
                fontWeight: s.status === 'active' ? 500 : 400 }}>{s.label}</div>
              {s.status === 'active' && (
                <div style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: WF_C.accent, animation: 'pulse 1.2s infinite',
                }}/>
              )}
            </div>
          ))}

          <WfDiv style={{ margin: '16px 0' }}/>

          <WfLabel>métricas</WfLabel>
          <MetricRow k="tokens" v="1,248"/>
          <MetricRow k="latência" v="42.3s"/>
          <MetricRow k="custo" v="$0.018"/>
          <MetricRow k="modelo" v="gpt-creative v3"/>

          <WfDiv style={{ margin: '16px 0' }}/>

          <WfLabel>controles</WfLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <WfBtn label={state === 'streaming' ? '⏸ Pausar stream' : '▶ Retomar'} size="sm"/>
            <WfBtn label="Cancelar" ghost size="sm"/>
          </div>
        </div>

        {/* Center: trace stream */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: WF_C.ink, letterSpacing: -0.3 }}>
              Gerando criativos
            </div>
            {state === 'streaming' && <WfChip variant="accent">● streaming</WfChip>}
            {state === 'error-json' && <WfChip variant="err">● malformed JSON</WfChip>}
            {state === 'rate-limit' && <WfChip variant="warn">● rate limit</WfChip>}
            {state === 'done' && <WfChip variant="ok">✓ concluído</WfChip>}
          </div>

          {/* Trace console */}
          <WfBox style={{
            flex: 1, minHeight: 0, padding: 14, background: '#0f0f0f',
            fontFamily: wfFonts.mono, fontSize: 11, lineHeight: 1.65,
            color: '#c8c8c8', overflow: 'auto', border: 'none',
          }}>
            <TraceLine t="00.0s" tag="system" text="pipeline iniciado · run_id=7f2a1c"/>
            <TraceLine t="00.1s" tag="parse" text="brief parsed · 4 campos detectados"/>
            <TraceLine t="00.3s" tag="prompt" text="contexto montado · 842 tokens"/>
            <TraceLine t="00.4s" tag="llm" text="chamando gpt-creative v3…"/>
            <TraceLine t="01.2s" tag="stream" text="← primeiro token recebido"/>
            <TraceLine t="01.2s" tag="stream" json color="#8ab4f8">{`{`}</TraceLine>
            <TraceLine t="01.3s" tag="stream" json color="#8ab4f8">{`  "variants": [`}</TraceLine>
            <TraceLine t="01.5s" tag="stream" json color="#8ab4f8">{`    {`}</TraceLine>
            <TraceLine t="01.8s" tag="stream" json color="#c3e88d">{`      "headline": "Sua próxima corrida começa`}</TraceLine>
            {state === 'streaming' && (
              <TraceLine t="02.1s" tag="stream" json color="#c3e88d" active>{`      aqui█`}</TraceLine>
            )}
            {state === 'error-json' && (
              <>
                <TraceLine t="02.1s" tag="stream" json color="#c3e88d">{`      aqui."`}</TraceLine>
                <TraceLine t="02.3s" tag="stream" json color="#c3e88d">{`      "body": "Urban Run X3 leve`}</TraceLine>
                <TraceLine t="02.8s" tag="stream" json color="#ff5370">{`      confiante... <EOS prematuro>`}</TraceLine>
                <TraceLine t="02.9s" tag="validator" text="✗ JSON parse error: Unexpected end of string at position 284" color="#ff5370"/>
                <TraceLine t="03.0s" tag="recover" text="iniciando auto-reparo (tentativa 1/3)…" color="#ffcb6b"/>
              </>
            )}
            {state === 'rate-limit' && (
              <TraceLine t="02.1s" tag="llm" text="429 Too Many Requests · retry em 18s · 2/3 tentativas restantes" color="#ffcb6b"/>
            )}
            {state === 'done' && (
              <>
                <TraceLine t="02.1s" tag="stream" json color="#c3e88d">{`      aqui."`}</TraceLine>
                <TraceLine t="04.8s" tag="validator" text="✓ 5 variantes · JSON válido"/>
                <TraceLine t="42.3s" tag="pipeline" text="concluído · 5 variantes · 15 renders" color="#c3e88d"/>
              </>
            )}
          </WfBox>

          {/* Error panel */}
          {state === 'error-json' && (
            <WfBox style={{
              padding: 12, background: 'oklch(0.97 0.02 25)',
              borderColor: 'oklch(0.8 0.1 25)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WfChip variant="err">ERRO</WfChip>
                <div style={{ fontSize: 12, color: WF_C.ink, fontWeight: 500 }}>
                  Resposta do LLM retornou JSON incompleto
                </div>
                <div style={{ flex: 1 }}/>
                <span style={{ fontFamily: wfFonts.mono, fontSize: 10, color: WF_C.muted }}>
                  reparo automático ativado
                </span>
              </div>
              <div style={{ fontSize: 11, color: WF_C.muted, lineHeight: 1.5 }}>
                O stream foi truncado antes do fechamento do JSON. Tentando parser tolerante + retry com temperatura reduzida. Se falhar 3×, fallback para modelo estável.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <WfBtn label="Ver raw output" size="sm" ghost/>
                <WfBtn label="Tentar novamente" size="sm"/>
                <WfBtn label="Usar fallback agora" size="sm" primary/>
              </div>
            </WfBox>
          )}
          {state === 'rate-limit' && (
            <WfBox style={{
              padding: 12, background: 'oklch(0.97 0.03 60)',
              borderColor: 'oklch(0.85 0.1 60)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <WfChip variant="warn">WAIT</WfChip>
              <div style={{ flex: 1, fontSize: 12, color: WF_C.ink }}>
                Rate limit da API. Retentando em <b style={{ fontFamily: wfFonts.mono }}>17s</b>…
              </div>
              <div style={{
                width: 60, height: 4, background: 'oklch(0.9 0.05 60)', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{ width: '35%', height: '100%', background: WF_C.warn }}/>
              </div>
            </WfBox>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px', borderTop: `1px solid ${WF_C.softline}` }}>
        <div style={{ fontSize: 12, color: WF_C.muted, fontFamily: wfFonts.mono }}>
          {state === 'streaming' && <>gerando variante 2 de 5 · ~28s restantes</>}
          {state === 'error-json' && <>pausado · aguardando decisão</>}
          {state === 'rate-limit' && <>pausado · retry automático</>}
          {state === 'done' && <>5 variantes · 15 renders · pronto para revisão</>}
        </div>
        <div style={{ flex: 1 }}/>
        <WfBtn label={state === 'done' ? 'Revisar variantes →' : 'Aguarde…'} primary style={{ opacity: state === 'done' ? 1 : 0.5 }}/>
      </div>
    </>
  );
}

function StepDot({ status }) {
  const color = status === 'done' ? WF_C.ok
    : status === 'active' ? WF_C.accent
    : status === 'error' ? WF_C.err
    : WF_C.line;
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${color}`,
      background: status === 'queued' ? '#fff' : color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, color: '#fff', flexShrink: 0,
    }}>
      {status === 'done' && '✓'}
      {status === 'error' && '!'}
    </div>
  );
}

function MetricRow({ k, v }) {
  return (
    <div style={{ display: 'flex', padding: '3px 0', fontFamily: wfFonts.mono, fontSize: 11 }}>
      <span style={{ flex: 1, color: WF_C.dim }}>{k}</span>
      <span style={{ color: WF_C.text }}>{v}</span>
    </div>
  );
}

function TraceLine({ t, tag, text, children, color, active, json }) {
  return (
    <div style={{ display: 'flex', gap: 10, opacity: active ? 1 : 0.95 }}>
      <span style={{ color: '#545454', width: 40, flexShrink: 0 }}>{t}</span>
      <span style={{ color: '#6b7280', width: 70, flexShrink: 0 }}>{tag}</span>
      <span style={{ color: color || '#c8c8c8', flex: 1 }}>
        {json ? children : text}
        {active && <span style={{ display: 'inline-block', width: 6, height: 10, background: 'currentColor', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }}/>}
      </span>
    </div>
  );
}

Object.assign(window, { Screen3Generation });
