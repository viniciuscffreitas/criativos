// Live progress panel for a studio run.
// Three nodes (planning / copy / render) shown as a horizontal pipeline.
// Each node lights up when its node_start fires and dims when node_done.
// Below the pipeline: §2.7 alert if error, plan summary card after
// plan_decided, streaming token preview, and a list of render_progress
// entries (one per file, with status pill).
import { useMemo } from 'react';
import type {
  StudioStreamEvent, StudioPlanPayload, RenderProgressPayload,
} from '../types';

interface StudioStreamProps {
  events: StudioStreamEvent[];
}

const NODES = [
  { id: 'planning', label: 'Entendendo seu pedido' },
  { id: 'copy',     label: 'Gerando copy' },
  { id: 'render',   label: 'Renderizando' },
] as const;

type NodeState = 'idle' | 'active' | 'done';

interface DerivedState {
  nodeStates: Record<string, NodeState>;
  plan: StudioPlanPayload | null;
  renderProgress: RenderProgressPayload[];
  errorMsg: string | null;
  tokensByNode: Record<string, string>;
}

function reduce(events: StudioStreamEvent[]): DerivedState {
  const nodeStates: Record<string, NodeState> = {
    planning: 'idle', copy: 'idle', render: 'idle',
  };
  let plan: StudioPlanPayload | null = null;
  const renderProgress: RenderProgressPayload[] = [];
  let errorMsg: string | null = null;
  const tokensByNode: Record<string, string> = {};

  for (const e of events) {
    if (e.type === 'node_start') {
      nodeStates[e.payload.node_id] = 'active';
    } else if (e.type === 'node_done') {
      nodeStates[e.payload.node_id] = 'done';
    } else if (e.type === 'plan_decided') {
      plan = e.payload.plan;
    } else if (e.type === 'render_progress') {
      // Replace existing entry for the same file (rendering -> ok flip)
      const idx = renderProgress.findIndex(p => p.file === e.payload.file);
      if (idx >= 0) renderProgress[idx] = e.payload;
      else renderProgress.push(e.payload);
    } else if (e.type === 'token') {
      tokensByNode[e.payload.node_id] =
        (tokensByNode[e.payload.node_id] ?? '') + e.payload.text;
    } else if (e.type === 'error') {
      errorMsg = e.payload.error;
    }
  }
  return { nodeStates, plan, renderProgress, errorMsg, tokensByNode };
}

export function StudioStream({ events }: StudioStreamProps) {
  const { nodeStates, plan, renderProgress, errorMsg, tokensByNode } =
    useMemo(() => reduce(events), [events]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e7e5e4',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {NODES.map((n, i) => (
          <Pipeline key={n.id} node={n}
            state={nodeStates[n.id]}
            isLast={i === NODES.length - 1}/>
        ))}
      </div>

      {errorMsg && (
        <div role="alert" style={{
          padding: '8px 12px', fontSize: 12, color: '#dc2626',
          background: 'rgba(220,38,38,0.10)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 6,
          fontFamily: '"Geist Mono", monospace',
        }}>erro: {errorMsg}</div>
      )}

      {plan && <PlanCard plan={plan}/>}

      {tokensByNode.copy && (
        <div style={{
          background: '#0a0a0a',
          color: '#a3e635',
          fontFamily: '"Geist Mono", monospace',
          fontSize: 11,
          padding: 10,
          borderRadius: 6,
          lineHeight: 1.5,
          maxHeight: 96,
          overflow: 'hidden',
        }}>
          {tokensByNode.copy.slice(-360)}
        </div>
      )}

      {renderProgress.length > 0 && <RenderProgressList items={renderProgress}/>}
    </div>
  );
}

interface PipelineProps {
  node: { id: string; label: string };
  state: NodeState;
  isLast: boolean;
}

function Pipeline({ node, state, isLast }: PipelineProps) {
  const dot = state === 'active' ? '#1c1917'
            : state === 'done' ? 'var(--accent, #04d361)'
            : '#d6d3d1';
  return (
    <>
      <div data-testid={`node-${node.id}`} data-state={state} style={{
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dot,
          transition: 'background 200ms',
          ...(state === 'active' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}),
        }}/>
        <span style={{
          fontSize: 12,
          color: state === 'idle' ? '#a8a29e' : '#1c1917',
          fontWeight: state === 'active' ? 500 : 400,
        }}>{node.label}</span>
      </div>
      {!isLast && (
        <div style={{ flex: 1, height: 1, background: '#e7e5e4' }}/>
      )}
    </>
  );
}

function PlanCard({ plan }: { plan: StudioPlanPayload }) {
  return (
    <div style={{
      background: '#fafaf9',
      border: '1px solid #e7e5e4',
      borderRadius: 8,
      padding: '10px 12px',
      fontSize: 12,
      color: '#44403c',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          background: '#1c1917', color: '#fafaf9',
          padding: '2px 6px', borderRadius: 4,
        }}>{plan.category}</span>
        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11 }}>
          {plan.template_id}
        </span>
        <span style={{ fontSize: 11, color: '#78716c' }}>·</span>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 11,
          textTransform: 'uppercase',
        }}>{plan.methodology}</span>
        <span style={{ fontSize: 11, color: '#78716c' }}>·</span>
        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11 }}>
          n={plan.n_variants}
        </span>
      </div>
      {plan.reasoning && (
        <div style={{
          fontSize: 11, color: '#6f6a64', fontStyle: 'italic',
          lineHeight: 1.4,
        }}>{plan.reasoning}</div>
      )}
    </div>
  );
}

function RenderProgressList({ items }: { items: RenderProgressPayload[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(it => {
        const failed = it.status === 'failed' || it.status === 'error';
        const ok = it.status === 'ok';
        const dotColor = ok ? 'var(--accent, #04d361)'
                       : failed ? '#dc2626'
                       : '#a8a29e';
        return (
          <div key={it.file} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: '"Geist Mono", monospace', fontSize: 11,
            padding: '4px 8px', borderRadius: 4,
            background: ok ? 'rgba(4, 211, 97, 0.08)' : '#fafaf9',
            color: failed ? '#dc2626' : '#1c1917',
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: dotColor,
              ...(it.status === 'rendering' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}),
            }}/>
            <span style={{ flex: 1 }}>{it.file}</span>
            <span style={{
              fontSize: 10, color: '#6f6a64',
              textTransform: 'uppercase', letterSpacing: 0.4,
            }}>{it.status}</span>
          </div>
        );
      })}
    </div>
  );
}
