// Generate step — consumes SSE stream from streamGenerate(), renders live token
// feed, node graph with confidence, and variant count.
import { useEffect, useRef, useState } from 'react';
import { streamGenerate } from '../../api';
import type { StreamEvent } from '../../api';
import type { AgentResult, CopyVariant, TraceNode } from '../../types';

interface GenerateProps {
  projectSlug: string;
  adId: string;
  methodology: string;
  nVariants: number;
  onDone: (result: AgentResult) => void;
}

export function Generate({ projectSlug, adId, methodology, nVariants, onDone }: GenerateProps) {
  const [tokens, setTokens] = useState<string>('');
  const [variants, setVariants] = useState<CopyVariant[]>([]);
  const [nodes, setNodes] = useState<TraceNode[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const tokenPanelRef = useRef<HTMLDivElement>(null);

  // Ref keeps the latest onDone without re-subscribing the stream on every
  // render (parent passes an inline arrow). Effect depends on stream keys only.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const abort = streamGenerate(
      { project_slug: projectSlug, ad_id: adId, methodology, n_variants: nVariants, persist: true },
      (e: StreamEvent) => {
        if (e.type === 'run_start') {
          // Stream boundary marker — no UI effect. Explicit branch documents intent.
        } else if (e.type === 'token') {
          setTokens(t => t + e.payload.text);
        } else if (e.type === 'variant_done') {
          setVariants(v => [...v, e.payload]);
        } else if (e.type === 'node_start') {
          setNodes(n => [...n, {
            id: e.payload.node_id,
            label: e.payload.label,
            start_ms: e.payload.start_ms,
            end_ms: 0,
            tokens: 0,
            confidence: null,
            output_preview: '',
          }]);
        } else if (e.type === 'node_done') {
          setNodes(n => n.map(x => x.id === e.payload.node_id ? {
            ...x,
            end_ms: e.payload.end_ms,
            tokens: e.payload.tokens,
            confidence: e.payload.confidence,
            output_preview: e.payload.output_preview,
          } : x));
        } else if (e.type === 'done') {
          onDoneRef.current(e.payload);
        } else if (e.type === 'error') {
          console.error('[Generate] stream error', e.payload);
          setStreamError(`${e.payload.code}: ${e.payload.error}`);
        } else {
          // Exhaustiveness guard — compile error if StreamEvent gains a variant.
          const _never: never = e;
          throw new Error(`[Generate] unhandled StreamEvent: ${JSON.stringify(_never)}`);
        }
      },
    );
    return abort;
  }, [projectSlug, adId, methodology, nVariants]);

  // Auto-scroll token panel to bottom as tokens arrive
  useEffect(() => {
    const el = tokenPanelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tokens]);

  const isStreaming = !streamError && variants.length < nVariants;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 24, gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
          Etapa 2 · geração
        </span>
        <StatusPill streaming={isStreaming} error={!!streamError} />
      </div>

      {/* Error banner */}
      {streamError && (
        <div role="alert" style={{
          padding: '10px 14px',
          background: 'rgba(220, 38, 38, 0.10)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          borderRadius: 6,
          color: '#dc2626',
          fontFamily: '"Geist Mono", monospace',
          fontSize: 12,
        }}>
          {streamError}
        </div>
      )}

      {/* Main two-column layout */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Left: token stream */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#78716c', letterSpacing: 0.5,
            textTransform: 'uppercase', marginBottom: 6,
          }}>Stream de tokens</div>
          <div
            ref={tokenPanelRef}
            data-testid="token-stream"
            style={{
              flex: 1, minHeight: 0,
              background: '#1c1917',
              borderRadius: 8,
              padding: '12px 14px',
              overflowY: 'auto',
              fontFamily: '"Geist Mono", monospace',
              fontSize: 12,
              color: '#d6d3d1',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            {tokens || <span style={{ color: '#57534e' }}>aguardando agente…</span>}
          </div>
        </div>

        {/* Right: node graph */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#78716c', letterSpacing: 0.5,
            textTransform: 'uppercase', marginBottom: 6,
          }}>Pipeline · {methodology}</div>
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {nodes.length === 0 && (
              <div style={{ color: '#78716c', fontSize: 12, padding: '10px 0' }}>sem nós ainda…</div>
            )}
            {nodes.map(node => (
              <NodePill key={node.id} node={node} />
            ))}
          </div>
        </div>
      </div>

      {/* Variants strip */}
      <VariantsStrip variants={variants} nVariants={nVariants} />
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusPill({ streaming, error }: { streaming: boolean; error: boolean }) {
  if (error) {
    return (
      <span style={{
        padding: '2px 9px', borderRadius: 20,
        background: 'rgba(220, 38, 38, 0.12)',
        color: '#dc2626',
        fontSize: 11, fontWeight: 500,
        fontFamily: '"Geist Mono", monospace',
      }}>erro</span>
    );
  }
  if (streaming) {
    return (
      <span style={{
        padding: '2px 9px', borderRadius: 20,
        background: '#f5f5f4',
        color: '#44403c',
        fontSize: 11, fontWeight: 500,
        fontFamily: '"Geist Mono", monospace',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}>streaming…</span>
    );
  }
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20,
      background: '#dcfce7',
      color: '#166534',
      fontSize: 11, fontWeight: 500,
      fontFamily: '"Geist Mono", monospace',
    }}>concluído</span>
  );
}

// ── Node pill ──────────────────────────────────────────────────────────────────

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

// ── Variants strip ─────────────────────────────────────────────────────────────

function VariantsStrip({ variants, nVariants }: { variants: CopyVariant[]; nVariants: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: '#fafaf9',
      border: '1px solid #e7e5e4',
      borderRadius: 6,
    }}>
      <span style={{
        fontSize: 12, fontWeight: 500, color: '#44403c',
        fontFamily: '"Geist Mono", monospace',
        marginRight: 4,
      }}>
        {variants.length} / {nVariants} variantes
      </span>
      {variants.map(v => (
        <span key={v.id} style={{
          padding: '2px 8px', borderRadius: 20,
          background: '#e7e5e4', color: '#44403c',
          fontSize: 11, fontFamily: '"Geist Mono", monospace',
        }}>
          {v.confidence_symbol}
        </span>
      ))}
    </div>
  );
}
