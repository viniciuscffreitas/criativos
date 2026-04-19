// Multi-step flow: Setup → Generate → Review → Export.
// Only Step 0 (Setup) is wired in this task; steps 1-3 are placeholders.
import { useEffect, useState } from 'react';
import type { Brief } from '../types';
import { loadBrief, saveBrief } from '../data/brief';
import { Setup } from './flow/Setup';

type Step = 0 | 1 | 2 | 3;

interface FlowViewProps {
  projectSlug: string;
  adId: string;
  onFinish: () => void;
}

export function FlowView({ projectSlug, adId, onFinish: _onFinish }: FlowViewProps) {
  const [step, setStep] = useState<Step>(0);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [methodology, setMethodology] = useState<'pas' | 'aida' | 'bab'>('pas');
  const [nVariants, setNVariants] = useState<number>(3);

  useEffect(() => {
    loadBrief(projectSlug, adId)
      .then(setBrief)
      .catch((e: Error) => {
        console.error('[FlowView] loadBrief failed', e);
        setBriefError(e.message);
      });
  }, [projectSlug, adId]);

  if (briefError) {
    return (
      <div role="alert" style={{ padding: 24, color: '#f87171' }}>
        erro ao carregar briefing: {briefError}
      </div>
    );
  }
  if (!brief) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted, #a3a3a3)' }}>
        Carregando briefing…
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <StepHeader step={step} />
      {step === 0 && (
        <Setup
          projectSlug={projectSlug}
          adId={adId}
          brief={brief}
          onChangeBrief={setBrief}
          methodology={methodology}
          setMethodology={setMethodology}
          nVariants={nVariants}
          setNVariants={setNVariants}
          onNext={async () => {
            await saveBrief(projectSlug, adId, brief);
            setStep(1);
          }}
        />
      )}
      {step === 1 && <div style={{ padding: 24 }}>Generate — Task 15</div>}
      {step === 2 && <div style={{ padding: 24 }}>Review — Task 16</div>}
      {step === 3 && <div style={{ padding: 24 }}>Export — Task 17</div>}
    </div>
  );
}

// ── Step header ────────────────────────────────────────────────────────────────

const STEPS: { id: string; label: string; sub: string }[] = [
  { id: 'setup',    label: 'Setup',    sub: 'Briefing + metodologia' },
  { id: 'generate', label: 'Geração',  sub: 'Agente trabalhando' },
  { id: 'review',   label: 'Revisão',  sub: 'Variantes + ajustes' },
  { id: 'export',   label: 'Export',   sub: 'Envio para Meta' },
];

function StepHeader({ step }: { step: Step }) {
  return (
    <div style={{
      padding: '14px 24px', background: '#ffffff',
      borderBottom: '1px solid var(--border, #e7e5e4)',
      display: 'flex', alignItems: 'center', gap: 0,
    }}>
      <h1 style={{
        margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917',
        letterSpacing: -0.1, marginRight: 20,
      }}>Novo fluxo criativo</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <StepPill key={s.id} index={i} label={s.label} done={done} active={active} />
          );
        })}
      </div>
      <div style={{
        fontFamily: '"Geist Mono", monospace', fontSize: 10,
        padding: '3px 8px', borderRadius: 4,
        background: '#f5f5f4', color: '#78716c',
      }}>{step + 1} / {STEPS.length}</div>
    </div>
  );
}

interface StepPillProps {
  index: number;
  label: string;
  done: boolean;
  active: boolean;
}

function StepPill({ index, label, done, active }: StepPillProps) {
  return (
    <>
      {index > 0 && (
        <div style={{
          width: 28, height: 1,
          background: done ? '#028a40' : '#e7e5e4',
          flexShrink: 0,
        }} />
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px 5px 5px', borderRadius: 6,
        background: active ? '#fafaf9' : 'transparent',
        flexShrink: 0,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: done ? '#028a40' : active ? '#1c1917' : '#fafaf9',
          border: done ? 'none' : active ? 'none' : '1px solid #d6d3d1',
          color: (done || active) ? '#fff' : '#6f6a64',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600,
          fontFamily: '"Geist Mono", monospace',
          flexShrink: 0,
        }}>
          {done ? '✓' : index + 1}
        </div>
        <div style={{
          fontSize: 12, fontWeight: active ? 600 : 500,
          color: active ? '#1c1917' : done ? '#44403c' : '#6f6a64',
          letterSpacing: -0.1,
        }}>{label}</div>
      </div>
    </>
  );
}
