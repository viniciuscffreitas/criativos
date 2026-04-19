// GenerationTraceModal — loads trace via api.getTrace and renders node graph + raw chain-of-thought.
// Inputs: runId (null = unmounted), onClose callback.
// Outputs: renders §2.8 trace: node confidence graph + raw reasoning text.
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AgentResult, TraceNode } from '../types';

interface GenerationTraceModalProps {
  runId: string | null;
  onClose: () => void;
}

export function GenerationTraceModal({ runId, onClose }: GenerationTraceModalProps) {
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    setResult(null);
    setTraceError(null);
    setLoading(true);
    api.getTrace(runId)
      .then(r => { setResult(r); setLoading(false); })
      .catch((e: Error) => {
        console.error('[GenerationTraceModal] getTrace failed', e);
        setTraceError(e.message);
        setLoading(false);
      });
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [runId, onClose]);

  if (!runId) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxHeight: '80vh',
          background: '#fff',
          borderRadius: 10,
          border: '1px solid #e7e5e4',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e7e5e4',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
            {result
              ? `Trace · ${result.methodology} · ${result.variants.length} variantes`
              : 'Trace'}
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar trace"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#78716c', lineHeight: 1,
              padding: '2px 4px', borderRadius: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && (
            <div style={{ fontSize: 13, color: '#78716c', fontFamily: '"Geist Mono", monospace' }}>
              Carregando trace…
            </div>
          )}

          {traceError && (
            <div role="alert" style={{
              padding: '10px 14px',
              background: 'rgba(220, 38, 38, 0.10)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: 6,
              color: '#dc2626',
              fontFamily: '"Geist Mono", monospace',
              fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span>{traceError}</span>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: '1px solid #dc2626', borderRadius: 4,
                  cursor: 'pointer', fontSize: 11, color: '#dc2626',
                  padding: '2px 8px', flexShrink: 0,
                }}
              >
                Fechar
              </button>
            </div>
          )}

          {result && (
            <>
              {/* Node graph */}
              {result.trace_structured.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: '#78716c',
                    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
                  }}>Pipeline nodes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.trace_structured.map(node => (
                      <NodePill key={node.id} node={node} />
                    ))}
                  </div>
                </div>
              )}

              {/* Raw chain-of-thought trace (§2.8) */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: '#78716c',
                  letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
                }}>Chain-of-thought</div>
                <pre style={{
                  margin: 0,
                  padding: '12px 14px',
                  background: '#1c1917',
                  borderRadius: 8,
                  color: '#d6d3d1',
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: 11,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {result.trace}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Node pill (duplicated from Generate.tsx — DAMP §2.3: second usage) ─────────

function confidenceSymbol(confidence: number | null): string {
  if (confidence === null) return '…';
  if (confidence >= 0.75) return '✅';
  if (confidence >= 0.4) return '⚠️';
  return '🔴';
}

function NodePill({ node }: { node: TraceNode }) {
  const done = node.end_ms > 0;
  const durationMs = done ? node.end_ms - node.start_ms : null;

  return (
    <div style={{
      padding: '8px 10px', borderRadius: 6,
      background: done ? '#fafaf9' : '#f5f5f4',
      border: `1px solid ${done ? '#e7e5e4' : '#d6d3d1'}`,
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1c1917' }}>{node.label}</span>
        <span style={{ fontSize: 13 }}>{done ? confidenceSymbol(node.confidence) : '⋯'}</span>
      </div>
      {done && (
        <div style={{
          display: 'flex', gap: 8,
          fontFamily: '"Geist Mono", monospace', fontSize: 10, color: '#78716c',
        }}>
          <span>{node.tokens} tok</span>
          {durationMs !== null && <span>{durationMs} ms</span>}
        </div>
      )}
    </div>
  );
}
