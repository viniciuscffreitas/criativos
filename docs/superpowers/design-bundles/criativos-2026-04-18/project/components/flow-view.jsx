// Streamlined 3-step flow for Criativos app
// Steps: Setup (upload + brief) → Geração (transitional) → Revisão (w/ export menu)

function FlowView({ onFinish }) {
  const [step, setStep] = React.useState(0);
  const [genState, setGenState] = React.useState('streaming');
  const [reviewVar, setReviewVar] = React.useState('grid');
  const [uploadState, setUploadState] = React.useState('filled');
  const [method, setMethod] = React.useState('aida');
  const [nVariants, setNVariants] = React.useState(5);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // auto-advance generation → review
  React.useEffect(() => {
    if (step !== 1) return;
    setGenState('streaming');
    const t1 = setTimeout(() => setGenState('done'), 2800);
    const t2 = setTimeout(() => setStep(2), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step]);

  const steps = [
    { id: 'setup', label: 'Setup', sub: 'Ativos + briefing' },
    { id: 'gen',   label: 'Geração', sub: 'Agente trabalhando' },
    { id: 'review',label: 'Revisão', sub: 'Variantes + export' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafaf9', minWidth: 0 }}>
      <FlowStepper steps={steps} current={step} onJump={(i) => { if (i !== 1) setStep(i); }}/>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {step === 0 && <FlowSetup
          uploadState={uploadState} setUploadState={setUploadState}
          method={method} setMethod={setMethod}
          nVariants={nVariants} setNVariants={setNVariants}
          showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
        />}
        {step === 1 && <FlowGenerate state={genState} setState={setGenState}/>}
        {step === 2 && <FlowReviewExport variation={reviewVar} setVariation={setReviewVar} onFinish={onFinish}/>}
      </div>
      {step !== 1 && <FlowFooter step={step} setStep={setStep} total={steps.length}
        nVariants={nVariants} onFinish={onFinish}/>}
    </div>
  );
}

// ── Stepper ────────────────────────────────────
function FlowStepper({ steps, current, onJump }) {
  return (
    <div style={{
      padding: '14px 24px', background: '#ffffff',
      borderBottom: '1px solid #e7e5e4',
      display: 'flex', alignItems: 'center', gap: 0,
    }}>
      <h1 style={{
        margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917',
        letterSpacing: -0.1, marginRight: 20,
      }}>Novo fluxo criativo</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {steps.map((s, i) => {
          const done = i < current, active = i === current;
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <div style={{
                width: 32, height: 1,
                background: done ? 'oklch(0.55 0.15 145)' : '#e7e5e4',
              }}/>}
              <div onClick={() => onJump(i)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px 5px 5px', borderRadius: 6,
                cursor: 'pointer',
                background: active ? 'oklch(0.97 0.02 25)' : 'transparent',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: done ? 'oklch(0.55 0.15 145)' : active ? '#1c1917' : '#fafaf9',
                  border: done ? 'none' : active ? 'none' : '1px solid #d6d3d1',
                  color: (done || active) ? '#fff' : '#6f6a64',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600,
                  fontFamily: '"Geist Mono", monospace',
                }}>{done ? '✓' : i + 1}</div>
                <div style={{
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  color: active ? '#1c1917' : done ? '#44403c' : '#6f6a64',
                  letterSpacing: -0.1,
                }}>{s.label}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{
        fontFamily: '"Geist Mono", monospace', fontSize: 10,
        padding: '3px 8px', borderRadius: 4,
        background: '#f5f5f4', color: '#78716c',
      }}>{current + 1} / {steps.length}</div>
    </div>
  );
}

// ── Footer ─────────────────────────────────────
function FlowFooter({ step, setStep, total, nVariants, onFinish }) {
  const labels = ['Gerar criativos', '', 'Concluir fluxo'];
  const hints = [
    `8 ativos · ${nVariants} variantes × 3 formatos · ~${nVariants * 3} créditos`,
    '',
    '4 variantes aprovadas · pronto para envio',
  ];
  return (
    <div style={{
      padding: '14px 24px', background: '#ffffff',
      borderTop: '1px solid #e7e5e4',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <button onClick={() => setStep(Math.max(0, step === 2 ? 0 : step - 1))} disabled={step === 0}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 6,
          background: 'transparent', color: step === 0 ? '#d6d3d1' : '#57534e',
          border: 'none', fontSize: 12, fontFamily: 'inherit',
          cursor: step === 0 ? 'default' : 'pointer',
        }}>← {step === 2 ? 'Novo briefing' : 'Voltar'}</button>
      <div style={{
        fontSize: 11, color: '#78716c', whiteSpace: 'nowrap',
        fontFamily: '"Geist Mono", monospace',
      }}>{hints[step]}</div>
      <div style={{ flex: 1 }}/>
      <button
        onClick={() => {
          if (step === total - 1) onFinish?.();
          else setStep(step + 1);
        }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 6,
          background: '#1c1917', color: '#fafaf9',
          border: 'none', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          cursor: 'pointer',
        }}>
        {labels[step]}
        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 10, opacity: 0.6 }}>⌘↵</span>
      </button>
    </div>
  );
}

Object.assign(window, { FlowView });
