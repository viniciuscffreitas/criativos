// Export step — preview rendered PNG, show selected variants, download link, finish flow.
// Inputs: AgentResult + projectSlug + adId. Outputs: onFinish() to return to gallery.
import type { AgentResult } from '../../types';

interface ExportProps {
  projectSlug: string;
  adId: string;
  result: AgentResult;
  onFinish: () => void;
}

export function Export({ projectSlug, adId, result, onFinish }: ExportProps) {
  const selectedVariants = result.variants.filter(v => v.selected);
  const pngUrl = `/renders/${adId}-${projectSlug}.png`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid #e7e5e4',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
          Etapa 4 · export
        </span>
        <span style={{
          fontSize: 12, color: '#78716c',
          fontFamily: '"Geist Mono", monospace',
        }}>
          {selectedVariants.length} {selectedVariants.length === 1 ? 'variante selecionada' : 'variantes selecionadas'}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left: PNG preview */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#78716c', letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>Preview</div>
          <PreviewImage src={pngUrl} />
        </div>

        {/* Right: selected variants list */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#78716c', letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>Variantes selecionadas</div>

          {selectedVariants.length === 0 ? (
            <div style={{ fontSize: 13, color: '#78716c', fontStyle: 'italic' }}>
              Nenhuma variante selecionada — volte à revisão.
            </div>
          ) : (
            selectedVariants.map(v => (
              <div key={v.id} style={{
                padding: '12px 14px',
                borderRadius: 6,
                border: '1px solid #e7e5e4',
                background: '#fafaf9',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{v.confidence_symbol}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: '#1c1917', letterSpacing: -0.2,
                  }}>{v.headline}</span>
                </div>
                <p style={{
                  margin: 0, fontSize: 12, color: '#44403c', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {v.primary_text}
                </p>
                {v.ctas.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {v.ctas.map((cta, i) => (
                      <span key={i} style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: '#f5f5f4', border: '1px solid #e7e5e4',
                        fontSize: 11, color: '#57534e', fontWeight: 500,
                      }}>{cta}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid #e7e5e4',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
      }}>
        <button
          disabled
          title="Disponível na Spec 4"
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            borderRadius: 6, border: '1px solid #d6d3d1',
            background: '#f5f5f4', color: '#a8a29e',
            cursor: 'not-allowed',
          }}
        >
          Publicar no Meta
        </button>
        <a
          href={pngUrl}
          download
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            borderRadius: 6, border: '1px solid #d6d3d1',
            background: '#ffffff', color: '#1c1917',
            textDecoration: 'none', cursor: 'pointer',
            display: 'inline-block',
          }}
        >
          Baixar PNG
        </a>
        <button
          onClick={onFinish}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            borderRadius: 6, border: 'none',
            background: '#028a40', color: '#ffffff',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
        >
          Concluir
        </button>
      </div>
    </div>
  );
}

// ── Preview image ──────────────────────────────────────────────────────────────

function PreviewImage({ src }: { src: string }) {
  return (
    <div style={{
      width: 240, borderRadius: 6, overflow: 'hidden',
      border: '1px solid #e7e5e4', background: '#f5f5f4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 160,
    }}>
      <img
        src={src}
        alt="ad preview"
        style={{ width: '100%', display: 'block' }}
        onError={e => {
          const el = e.currentTarget;
          el.style.display = 'none';
          const parent = el.parentElement;
          if (parent) {
            const msg = document.createElement('span');
            msg.textContent = 'preview indisponível';
            msg.style.cssText = 'font-size:12px;color:#78716c;padding:24px;font-family:"Geist Mono",monospace;';
            parent.appendChild(msg);
          }
        }}
      />
    </div>
  );
}
