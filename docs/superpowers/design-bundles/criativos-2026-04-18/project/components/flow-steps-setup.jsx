// Step 1: Setup — upload + briefing unificados numa só tela
// Corta: orçamento, tom de voz tags "+ adicionar", checklist lateral, nº variantes,
// formatos (tudo vira Avançado ▸). Campos obrigatórios: produto + público.

function FlowSetup({
  uploadState, setUploadState,
  method, setMethod,
  nVariants, setNVariants,
  showAdvanced, setShowAdvanced,
}) {
  const files = [
    { name: 'logo_urban_run.svg', size: '8 KB', kind: 'logo' },
    { name: 'produto_x3_coral.png', size: '2.1 MB', kind: 'product' },
    { name: 'produto_x3_preto.png', size: '1.9 MB', kind: 'product' },
    { name: 'produto_x3_areia.png', size: '2.0 MB', kind: 'product' },
    { name: 'lifestyle_asfalto.jpg', size: '1.4 MB', kind: 'lifestyle' },
    { name: 'guia_marca.pdf', size: '412 KB', kind: 'doc' },
  ];

  const methods = [
    { id: 'aida', name: 'AIDA', sub: 'Atenção → Interesse → Desejo → Ação' },
    { id: 'pas',  name: 'PAS',  sub: 'Problem → Agitate → Solve' },
    { id: 'bab',  name: 'BAB',  sub: 'Before → After → Bridge' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{
              fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
              color: '#6f6a64', fontWeight: 500, marginBottom: 6,
              fontFamily: '"Geist Mono", monospace',
            }}>etapa 1 · setup</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: -0.3 }}>
              Briefing & ativos
            </div>
            <div style={{ fontSize: 13, color: '#57534e', marginTop: 4, maxWidth: 560, lineHeight: 1.55 }}>
              Dois campos e alguns ativos são suficientes pra começar. O agente cuida do resto.
            </div>
          </div>

          {/* Core briefing */}
          <Field label="Produto ou serviço" required>
            <input defaultValue="Tênis Urban Run X3 — linha leve para corrida urbana"
              style={inputStyle}/>
          </Field>

          <Field label="Público-alvo" required>
            <textarea defaultValue="Adultos 22–38 anos, urbanos, praticantes de corrida casual 1–3× por semana. São Paulo, Rio, BH."
              rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}/>
          </Field>

          {/* Upload */}
          <Field label="Ativos da marca" hint="logo, fotos de produto, guia de marca">
            <div
              onDragOver={e => { e.preventDefault(); setUploadState('dragover'); }}
              onDragLeave={() => setUploadState(uploadState === 'dragover' ? 'filled' : 'empty')}
              onDrop={e => { e.preventDefault(); setUploadState('filled'); }}
              style={{
                border: `2px ${uploadState === 'empty' ? 'dashed' : 'solid'} ${uploadState === 'dragover' ? 'oklch(0.65 0.18 25)' : '#e7e5e4'}`,
                borderRadius: 10,
                background: uploadState === 'dragover' ? 'oklch(0.97 0.02 25)' : '#ffffff',
                padding: uploadState === 'filled' ? 14 : 28,
                transition: 'all 0.15s',
              }}
            >
              {uploadState === 'empty' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#f5f5f4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6f6a64',
                  }}><IconUpload size={16}/></div>
                  <div style={{ fontSize: 13, color: '#44403c' }}>
                    Arraste ou{' '}
                    <span onClick={() => setUploadState('filled')} style={{
                      color: 'oklch(0.55 0.18 25)', textDecoration: 'underline', cursor: 'pointer',
                    }}>escolha do computador</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6f6a64', fontFamily: '"Geist Mono", monospace' }}>
                    png · jpg · svg · pdf · mp4 · até 50MB
                  </div>
                </div>
              )}

              {uploadState === 'dragover' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.55 0.18 25)' }}>Solte para enviar</div>
                </div>
              )}

              {uploadState === 'filled' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                  gap: 8,
                }}>
                  {files.map((f, i) => <FileTile key={i} file={f} idx={i}/>)}
                  <div onClick={() => {}} style={{
                    aspectRatio: '1', borderRadius: 6,
                    border: '2px dashed #d6d3d1', background: '#fafaf9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#6f6a64',
                  }}><IconPlus size={18}/></div>
                </div>
              )}
            </div>
          </Field>

          {/* Methodology */}
          <Field label="Metodologia">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {methods.map(m => {
                const sel = method === m.id;
                return (
                  <div key={m.id} onClick={() => setMethod(m.id)} style={{
                    padding: 12, borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${sel ? '#1c1917' : '#e7e5e4'}`,
                    background: sel ? '#fafaf9' : '#fff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${sel ? '#1c1917' : '#d6d3d1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1c1917' }}/>}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1c1917',
                        fontFamily: '"Geist Mono", monospace' }}>{m.name}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#57534e', marginLeft: 22, lineHeight: 1.4 }}>{m.sub}</div>
                  </div>
                );
              })}
            </div>
          </Field>

          {/* Advanced toggle */}
          <div>
            <div onClick={() => setShowAdvanced(!showAdvanced)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#57534e', cursor: 'pointer',
              padding: '4px 0',
            }}>
              <span style={{
                display: 'inline-block',
                transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)',
                transition: 'transform 0.15s',
                fontFamily: '"Geist Mono", monospace', fontSize: 10,
              }}>▸</span>
              Opções avançadas
              <span style={{
                fontSize: 11, color: '#78716c', fontFamily: '"Geist Mono", monospace',
              }}>· variantes, formatos, tom</span>
            </div>

            {showAdvanced && (
              <div style={{
                marginTop: 12, padding: 18, background: '#fff', borderRadius: 8,
                border: '1px solid #e7e5e4',
                display: 'flex', flexDirection: 'column', gap: 16,
                animation: 'fadeInUp 0.2s ease-out',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Variantes" compact>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[3, 5, 8, 12].map(n => (
                        <div key={n} onClick={() => setNVariants(n)} style={{
                          flex: 1, padding: '8px 0', textAlign: 'center',
                          fontFamily: '"Geist Mono", monospace', fontSize: 12,
                          border: `1px solid ${n === nVariants ? '#1c1917' : '#e7e5e4'}`,
                          background: n === nVariants ? '#1c1917' : '#fff',
                          color: n === nVariants ? '#fff' : '#44403c',
                          borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                        }}>{n}</div>
                      ))}
                    </div>
                  </Field>
                  <Field label="Formatos" compact>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[['1:1', true], ['9:16', true], ['4:5', true], ['16:9', false]].map(([f, sel]) => (
                        <div key={f} style={{
                          padding: '6px 11px', borderRadius: 6, fontSize: 12,
                          fontFamily: '"Geist Mono", monospace',
                          background: sel ? '#1c1917' : '#fff',
                          color: sel ? '#fafaf9' : '#44403c',
                          border: `1px solid ${sel ? '#1c1917' : '#e7e5e4'}`,
                          cursor: 'pointer',
                        }}>{f}</div>
                      ))}
                    </div>
                  </Field>
                </div>

                <Field label="Tom de voz" compact>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['Energético', true], ['Confiante', true], ['Direto', false], ['Inspiracional', false], ['Humor', false]].map(([t, sel]) => (
                      <div key={t} style={{
                        padding: '6px 10px', borderRadius: 6, fontSize: 12,
                        background: sel ? '#1c1917' : '#fff',
                        color: sel ? '#fafaf9' : '#44403c',
                        border: `1px solid ${sel ? '#1c1917' : '#e7e5e4'}`,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>{t}</div>
                    ))}
                  </div>
                </Field>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side: prompt preview (slimmer) */}
      <div style={{
        width: 280, flexShrink: 0,
        borderLeft: '1px solid #e7e5e4', background: '#fafaf9',
        padding: '28px 20px', overflow: 'auto',
      }}>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          color: '#6f6a64', fontWeight: 500, marginBottom: 10,
          fontFamily: '"Geist Mono", monospace',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Prompt preview
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'oklch(0.65 0.18 25)',
            animation: 'pulse 1.2s ease-in-out infinite' }}/>
        </div>
        <div style={{
          background: '#1c1917', borderRadius: 8, padding: 14,
          fontFamily: '"Geist Mono", monospace', fontSize: 11, lineHeight: 1.7,
          color: '#d6d3d1',
        }}>
          <div style={{ color: '#78716c' }}>system:</div>
          <div>copywriter sênior Meta Ads.</div>
          <div style={{ color: '#78716c', marginTop: 10 }}>user:</div>
          <div>produto: <span style={{ color: '#fafaf9' }}>Urban Run X3</span></div>
          <div>método: <span style={{ color: 'oklch(0.8 0.15 25)' }}>{method.toUpperCase()}</span></div>
          <div>público: 22-38 urbanos</div>
          <div>n: <span style={{ color: '#fafaf9' }}>{nVariants}</span></div>
        </div>
        <div style={{
          marginTop: 12, padding: 12, background: '#fff',
          borderRadius: 6, border: '1px solid #e7e5e4',
          fontSize: 11, color: '#57534e', lineHeight: 1.55,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <IconZap size={12} stroke="#78716c"/>
            <b style={{ color: '#1c1917', fontSize: 11 }}>Custo estimado</b>
          </div>
          <div style={{ fontFamily: '"Geist Mono", monospace',
            color: '#1c1917', fontWeight: 600, fontSize: 13 }}>
            {nVariants * 3} créditos
          </div>
          <div style={{ fontFamily: '"Geist Mono", monospace', color: '#6f6a64', fontSize: 10, marginTop: 2 }}>
            ≈ R$ 0,68 · ~42s
          </div>
        </div>
      </div>
    </div>
  );
}

function FileTile({ file, idx }) {
  const bgs = {
    logo: '#1c1917', product: 'linear-gradient(135deg, #fed7aa, #fb923c)',
    lifestyle: 'linear-gradient(135deg, #292524, #78716c)', video: 'linear-gradient(135deg, #292524, #44403c)',
    doc: '#fef3c7',
  };
  return (
    <div style={{
      aspectRatio: '1', borderRadius: 6, overflow: 'hidden',
      border: '1px solid #e7e5e4', position: 'relative',
      background: bgs[file.kind] || '#f5f5f4',
      animation: `fadeInUp 0.3s ease-out ${idx * 0.04}s backwards`,
    }}>
      {file.kind === 'logo' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fafaf9', fontSize: 9, fontWeight: 700, letterSpacing: -0.3,
        }}>URBAN RUN</div>
      )}
      {file.kind === 'doc' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#92400e', fontSize: 14, fontWeight: 700,
          fontFamily: '"Geist Mono", monospace',
        }}>PDF</div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '3px 5px', background: 'rgba(0,0,0,0.7)',
        color: '#fff', fontFamily: '"Geist Mono", monospace', fontSize: 9,
        display: 'flex', justifyContent: 'space-between', gap: 3,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </span>
      </div>
    </div>
  );
}

function Field({ label, hint, required, compact, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: '#44403c', marginBottom: compact ? 5 : 7, fontWeight: 500,
        display: 'flex', alignItems: 'baseline', gap: 6,
      }}>
        <span>{label}{required && <span style={{ color: 'oklch(0.55 0.18 25)', marginLeft: 3 }}>*</span>}</span>
        {hint && <span style={{ fontSize: 10, color: '#78716c', fontWeight: 400,
          fontFamily: '"Geist Mono", monospace' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 6,
  border: '1px solid #e7e5e4', background: '#fff',
  fontSize: 13, color: '#1c1917',
  fontFamily: 'inherit', outline: 'none',
};

Object.assign(window, { FlowSetup });
