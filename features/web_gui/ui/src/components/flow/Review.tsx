// Review step — variant card grid with select persistence (§2.7 error surface, §2.8 AI-UX).
// Inputs: AgentResult with variants. Outputs: selected variants persisted via PATCH.
import { useState } from 'react';
import type { AgentResult, CopyVariant } from '../../types';
import { api } from '../../api';

interface ReviewProps {
  result: AgentResult;
  onFinish: () => void;
}

export function Review({ result, onFinish }: ReviewProps) {
  const [variants, setVariants] = useState<CopyVariant[]>(result.variants);
  const [patchError, setPatchError] = useState<string | null>(null);

  const selectedCount = variants.filter(v => v.selected).length;

  const toggle = async (id: string) => {
    const v = variants.find(x => x.id === id);
    if (!v) return;
    const nextSelected = !v.selected;
    setVariants(vs => vs.map(x => x.id === id ? { ...x, selected: nextSelected } : x));
    setPatchError(null);
    try {
      await api.patchVariant(result.run_id, id, { selected: nextSelected });
    } catch (e) {
      console.error('[Review] patchVariant failed', e);
      setPatchError((e as Error).message);
      setVariants(vs => vs.map(x => x.id === id ? { ...x, selected: v.selected } : x));
    }
  };

  return (
    <div data-testid="review-screen" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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
          Etapa 3 · revisão
        </span>
        <span style={{
          fontSize: 12,
          color: '#78716c',
          fontFamily: '"Geist Mono", monospace',
        }}>
          {selectedCount} / {variants.length} selecionadas
        </span>
      </div>

      {/* Error banner */}
      {patchError && (
        <div role="alert" style={{
          padding: '8px 24px',
          background: 'rgba(220, 38, 38, 0.12)',
          color: '#dc2626',
          fontFamily: '"Geist Mono", monospace',
          fontSize: 12,
          borderBottom: '1px solid #e7e5e4',
        }}>
          erro ao salvar seleção: {patchError}
        </div>
      )}

      {/* Variant grid */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 16,
        alignContent: 'start',
      }}>
        {variants.map(v => (
          <VariantCard key={v.id} variant={v} onToggle={() => toggle(v.id)} />
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid #e7e5e4',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <button
          onClick={onFinish}
          disabled={selectedCount === 0}
          style={{
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
            background: selectedCount === 0 ? '#d6d3d1' : '#028a40',
            color: selectedCount === 0 ? '#78716c' : '#ffffff',
            transition: 'background 150ms ease',
            letterSpacing: -0.1,
          }}
        >
          Próximo
        </button>
      </div>
    </div>
  );
}

// ── Variant card ────────────────────────────────────────────────────────────────

interface VariantCardProps {
  variant: CopyVariant;
  onToggle: () => void;
}

function VariantCard({ variant: v, onToggle }: VariantCardProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const hasWarning = Math.min(v.axes.relevance, v.axes.originality, v.axes.brand_fit) < 0.4;

  return (
    <div
      onClick={onToggle}
      data-testid="variant-card"
      style={{
        borderRadius: 8,
        border: v.selected ? '2px solid #1c1917' : '1px solid #e7e5e4',
        background: v.selected ? '#fafaf9' : '#ffffff',
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 150ms ease, background 150ms ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
      }}
    >
      {/* Selected checkmark */}
      {v.selected && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#028a40',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}>✓</div>
      )}

      {/* Card header: symbol + headline + axes bars */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: v.selected ? 28 : 0 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }} title={`confidence: ${v.confidence}`}>
          {v.confidence_symbol}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1c1917',
            letterSpacing: -0.2,
            lineHeight: 1.3,
            marginBottom: 8,
          }}>
            {v.headline}
          </div>
          <AxesBars axes={v.axes} />
        </div>
      </div>

      {/* Warning chip */}
      {hasWarning && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 4,
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#f59e0b',
          fontSize: 11,
          fontWeight: 500,
          alignSelf: 'flex-start',
        }}>
          ⚠️ eixo fraco (&lt;0.4)
        </div>
      )}

      {/* Primary text */}
      <p style={{
        margin: 0,
        fontSize: 12,
        color: '#44403c',
        lineHeight: 1.5,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {v.primary_text}
      </p>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: 11,
        color: '#78716c',
        lineHeight: 1.4,
      }}>
        {v.description}
      </p>

      {/* CTA chips */}
      {v.ctas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {v.ctas.map((cta, i) => (
            <span key={i} style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: '#f5f5f4',
              border: '1px solid #e7e5e4',
              fontSize: 11,
              color: '#57534e',
              fontWeight: 500,
            }}>{cta}</span>
          ))}
        </div>
      )}

      {/* Reasoning toggle (§2.8 chain-of-thought) */}
      <div>
        <button
          onClick={e => { e.stopPropagation(); setReasoningOpen(o => !o); }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 11,
            color: '#78716c',
            textDecoration: 'underline',
            fontFamily: 'inherit',
          }}
        >
          {reasoningOpen ? 'ocultar raciocínio' : 'ver raciocínio'}
        </button>
        {reasoningOpen && (
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 4,
            background: '#f5f5f4',
            fontSize: 11,
            color: '#57534e',
            lineHeight: 1.5,
            fontFamily: '"Geist Mono", monospace',
          }}>
            {v.reasoning}
          </div>
        )}
      </div>

      {/* Confidence score */}
      <div style={{
        fontSize: 10,
        color: '#78716c',
        fontFamily: '"Geist Mono", monospace',
      }}>
        score: {(v.confidence_score * 100).toFixed(0)}%
      </div>
    </div>
  );
}

// ── Axes mini-bars ──────────────────────────────────────────────────────────────

interface AxesBarsProps {
  axes: CopyVariant['axes'];
}

function AxesBars({ axes }: AxesBarsProps) {
  const bars: { label: string; value: number }[] = [
    { label: 'rel', value: axes.relevance },
    { label: 'orig', value: axes.originality },
    { label: 'fit', value: axes.brand_fit },
  ];

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {bars.map(b => (
        <div key={b.label} style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9,
            color: '#78716c',
            fontFamily: '"Geist Mono", monospace',
            marginBottom: 2,
            letterSpacing: 0.2,
          }}>
            {b.label}
          </div>
          <div style={{
            height: 3,
            borderRadius: 2,
            background: '#e7e5e4',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(b.value * 100)}%`,
              borderRadius: 2,
              background: b.value < 0.4 ? '#f59e0b' : '#028a40',
              transition: 'width 300ms ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
