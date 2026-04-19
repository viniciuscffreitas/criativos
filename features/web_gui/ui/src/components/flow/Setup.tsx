// Step 0: Setup — briefing fields + methodology selection.
// Controlled inputs bound to the Brief loaded by FlowView.
// Upload zone and advanced options (formats, tone) are deferred — not part of Brief schema.
import type { Brief } from '../../types';

interface SetupProps {
  projectSlug: string;
  adId: string;
  brief: Brief;
  onChangeBrief: (b: Brief) => void;
  onNext: () => void;
  nVariants: number;
  setNVariants: (n: number) => void;
  methodology: 'pas' | 'aida' | 'bab';
  setMethodology: (m: 'pas' | 'aida' | 'bab') => void;
}

export function Setup({
  projectSlug: _projectSlug,
  adId: _adId,
  brief,
  onChangeBrief,
  onNext,
  nVariants,
  setNVariants,
  methodology,
  setMethodology,
}: SetupProps) {
  const methods: { id: 'pas' | 'aida' | 'bab'; name: string; sub: string; disabled?: boolean }[] = [
    { id: 'pas',  name: 'PAS',  sub: 'Problem → Agitate → Solve' },
    { id: 'aida', name: 'AIDA', sub: 'Atenção → Interesse → Desejo → Ação', disabled: true },
    { id: 'bab',  name: 'BAB',  sub: 'Before → After → Bridge', disabled: true },
  ];

  function set<K extends keyof Brief>(key: K, value: Brief[K]) {
    onChangeBrief({ ...brief, [key]: value });
  }

  function addCta() {
    set('ctas', [...brief.ctas, '']);
  }

  function removeCta(idx: number) {
    set('ctas', brief.ctas.filter((_, i) => i !== idx));
  }

  function updateCta(idx: number, value: string) {
    const next = [...brief.ctas];
    next[idx] = value;
    set('ctas', next);
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      {/* Main form column */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Header */}
          <div>
            <div style={{
              fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
              color: '#6f6a64', fontWeight: 500, marginBottom: 6,
              fontFamily: '"Geist Mono", monospace',
            }}>etapa 1 · setup</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: -0.3 }}>
              Briefing & metodologia
            </div>
            <div style={{ fontSize: 13, color: '#57534e', marginTop: 4, maxWidth: 560, lineHeight: 1.55 }}>
              Preencha o briefing e escolha a metodologia. O agente cuida do resto.
            </div>
          </div>

          {/* Produto */}
          <Field label="Produto ou serviço" required>
            <input
              value={brief.product}
              onChange={e => set('product', e.target.value)}
              placeholder="Ex.: Tênis Urban Run X3 — linha leve para corrida urbana"
              style={inputStyle}
            />
          </Field>

          {/* Público-alvo */}
          <Field label="Público-alvo" required>
            <textarea
              value={brief.audience}
              onChange={e => set('audience', e.target.value)}
              placeholder="Ex.: Adultos 22–38 anos, urbanos, praticantes de corrida casual"
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </Field>

          {/* Dor */}
          <Field label="Principal dor / problema">
            <textarea
              value={brief.pain}
              onChange={e => set('pain', e.target.value)}
              placeholder="Ex.: Perder clientes para concorrentes com site real"
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </Field>

          {/* CTAs — array editor */}
          <Field label="CTAs" hint="chamadas para ação">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {brief.ctas.map((cta, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={cta}
                    onChange={e => updateCta(idx, e.target.value)}
                    placeholder="Ex.: Message me"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => removeCta(idx)}
                    disabled={brief.ctas.length <= 1}
                    title="Remover CTA"
                    style={{
                      flexShrink: 0, width: 28, height: 28,
                      border: '1px solid #e7e5e4', borderRadius: 6,
                      background: 'transparent', cursor: brief.ctas.length <= 1 ? 'default' : 'pointer',
                      color: brief.ctas.length <= 1 ? '#d6d3d1' : '#78716c',
                      fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={addCta}
                style={{
                  alignSelf: 'flex-start',
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px dashed #d6d3d1', background: 'transparent',
                  fontSize: 11, color: '#57534e', cursor: 'pointer',
                  fontFamily: '"Geist Mono", monospace',
                }}
              >+ adicionar CTA</button>
            </div>
          </Field>

          {/* Prova social */}
          <Field label="Prova social" hint="opcional">
            <input
              value={brief.social_proof ?? ''}
              onChange={e => set('social_proof', e.target.value || null)}
              placeholder="Ex.: 6 sites entregues no mês passado"
              style={inputStyle}
            />
          </Field>

          {/* Methodology */}
          <Field label="Metodologia">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {methods.map(m => {
                const sel = methodology === m.id && !m.disabled;
                return (
                  <div
                    key={m.id}
                    onClick={() => { if (!m.disabled) setMethodology(m.id); }}
                    title={m.disabled ? 'Em breve — Spec 2' : undefined}
                    style={{
                      padding: 12, borderRadius: 8,
                      cursor: m.disabled ? 'not-allowed' : 'pointer',
                      border: `1px solid ${sel ? '#1c1917' : '#e7e5e4'}`,
                      background: m.disabled ? '#fafaf9' : sel ? '#fafaf9' : '#fff',
                      opacity: m.disabled ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${sel ? '#1c1917' : '#d6d3d1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1c1917' }}/>}
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: '#1c1917',
                        fontFamily: '"Geist Mono", monospace',
                      }}>{m.name}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#57534e', marginLeft: 22, lineHeight: 1.4 }}>{m.sub}</div>
                  </div>
                );
              })}
            </div>
          </Field>

          {/* Variants count */}
          <Field label="Variantes" hint="quantas variantes gerar (1–8)">
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 3, 5, 8].map(n => (
                <div
                  key={n}
                  onClick={() => setNVariants(n)}
                  style={{
                    flex: 1, padding: '8px 0', textAlign: 'center',
                    fontFamily: '"Geist Mono", monospace', fontSize: 12,
                    border: `1px solid ${n === nVariants ? '#1c1917' : '#e7e5e4'}`,
                    background: n === nVariants ? '#1c1917' : '#fff',
                    color: n === nVariants ? '#fff' : '#44403c',
                    borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                  }}
                >{n}</div>
              ))}
            </div>
          </Field>

          {/* Próximo */}
          <div style={{ paddingBottom: 8 }}>
            <button
              onClick={onNext}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 6,
                background: '#1c1917', color: '#fafaf9',
                border: 'none', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Próximo
              <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 10, opacity: 0.6 }}>⌘↵</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prompt preview sidebar */}
      <div style={{
        width: 260, flexShrink: 0,
        borderLeft: '1px solid #e7e5e4', background: '#fafaf9',
        padding: '28px 20px', overflow: 'auto',
      }}>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          color: '#6f6a64', fontWeight: 500, marginBottom: 10,
          fontFamily: '"Geist Mono", monospace',
        }}>
          Prompt preview
        </div>
        <div style={{
          background: '#1c1917', borderRadius: 8, padding: 14,
          fontFamily: '"Geist Mono", monospace', fontSize: 11, lineHeight: 1.7,
          color: '#d6d3d1',
        }}>
          <div style={{ color: '#78716c' }}>system:</div>
          <div>copywriter sênior Meta Ads.</div>
          <div style={{ color: '#78716c', marginTop: 10 }}>user:</div>
          <div>produto: <span style={{ color: '#fafaf9' }}>{brief.product || '—'}</span></div>
          <div>método: <span style={{ color: '#fb923c' }}>{methodology.toUpperCase()}</span></div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            público: {brief.audience || '—'}
          </div>
          <div>n: <span style={{ color: '#fafaf9' }}>{nVariants}</span></div>
        </div>
        <div style={{
          marginTop: 12, padding: 12, background: '#fff',
          borderRadius: 6, border: '1px solid #e7e5e4',
          fontSize: 11, color: '#57534e', lineHeight: 1.55,
        }}>
          <div style={{ fontWeight: 600, color: '#1c1917', fontSize: 11, marginBottom: 4 }}>
            Custo estimado
          </div>
          <div style={{
            fontFamily: '"Geist Mono", monospace',
            color: '#1c1917', fontWeight: 600, fontSize: 13,
          }}>
            {nVariants * 3} créditos
          </div>
          <div style={{
            fontFamily: '"Geist Mono", monospace',
            color: '#6f6a64', fontSize: 10, marginTop: 2,
          }}>
            ≈ ~{nVariants * 14}s
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, hint, required, children }: FieldProps) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: '#44403c', marginBottom: 7, fontWeight: 500,
        display: 'flex', alignItems: 'baseline', gap: 6,
      }}>
        <span>
          {label}
          {required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
        </span>
        {hint && (
          <span style={{
            fontSize: 10, color: '#78716c', fontWeight: 400,
            fontFamily: '"Geist Mono", monospace',
          }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 6,
  border: '1px solid #e7e5e4', background: '#fff',
  fontSize: 13, color: '#1c1917',
  fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
