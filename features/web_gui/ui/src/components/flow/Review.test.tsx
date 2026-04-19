// Review — variant selection, persistence, error revert, reasoning toggle, warning chip.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentResult, CopyVariant } from '../../types';

const patchVariantMock = vi.fn();
vi.mock('../../api', () => ({ api: { patchVariant: patchVariantMock } }));

const { Review } = await import('./Review');

// ── Fixtures ───────────────────────────────────────────────────────────────────

const VARIANT_A: CopyVariant = {
  id: 'v1',
  headline: 'Sites que convertem',
  primary_text: 'Texto principal da variante A',
  description: 'Descrição A',
  ctas: ['Saiba mais'],
  confidence: 'high',
  confidence_score: 0.9,
  axes: { relevance: 0.9, originality: 0.8, brand_fit: 0.85 },
  reasoning: 'Strong PAS fit porque o produto resolve uma dor clara.',
  selected: false,
  confidence_symbol: '✅',
};

const VARIANT_B: CopyVariant = {
  id: 'v2',
  headline: 'Design que vende',
  primary_text: 'Texto principal da variante B',
  description: 'Descrição B',
  ctas: ['Fale connosco'],
  confidence: 'low',
  confidence_score: 0.3,
  axes: { relevance: 0.3, originality: 0.2, brand_fit: 0.35 },
  reasoning: 'Weak fit — axes below threshold.',
  selected: true,
  confidence_symbol: '🔴',
};

const AGENT_RESULT: AgentResult = {
  run_id: 'run-test-001',
  variants: [VARIANT_A, VARIANT_B],
  trace: 'trace text',
  trace_structured: [],
  methodology: 'pas',
  model: 'claude-sonnet-4-6',
  pipeline_version: '1.0.0',
  seed: null,
  created_at: '2026-04-19T10:00:00Z',
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Review', () => {
  beforeEach(() => {
    patchVariantMock.mockReset();
    patchVariantMock.mockResolvedValue({});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders one card per variant with headline and confidence symbol', () => {
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);
    expect(screen.getByText('Sites que convertem')).toBeInTheDocument();
    expect(screen.getByText('Design que vende')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('🔴')).toBeInTheDocument();
  });

  it('clicking an unselected card calls patchVariant with selected:true and marks it selected', async () => {
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);

    // VARIANT_A starts unselected — click its headline area (the whole card)
    fireEvent.click(screen.getByText('Sites que convertem'));

    await waitFor(() => {
      expect(patchVariantMock).toHaveBeenCalledWith('run-test-001', 'v1', { selected: true });
    });

    // selectedCount should now show 2 / 2 (v1 toggled on, v2 was already selected)
    expect(screen.getByText('2 / 2 selecionadas')).toBeInTheDocument();
  });

  it('clicking a selected card calls patchVariant with selected:false and marks it unselected', async () => {
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);

    // VARIANT_B starts selected — click its headline area
    fireEvent.click(screen.getByText('Design que vende'));

    await waitFor(() => {
      expect(patchVariantMock).toHaveBeenCalledWith('run-test-001', 'v2', { selected: false });
    });

    // selectedCount should now show 0 / 2
    expect(screen.getByText('0 / 2 selecionadas')).toBeInTheDocument();
  });

  it('"Próximo" button is disabled when 0 variants selected', () => {
    const resultNoSelected: AgentResult = {
      ...AGENT_RESULT,
      variants: [VARIANT_A, { ...VARIANT_B, selected: false }],
    };
    render(<Review result={resultNoSelected} onFinish={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });

  it('"Próximo" button is enabled when 1+ variants selected', () => {
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);
    // VARIANT_B starts selected
    expect(screen.getByRole('button', { name: 'Próximo' })).not.toBeDisabled();
  });

  it('clicking "Próximo" calls onFinish', () => {
    const onFinish = vi.fn();
    render(<Review result={AGENT_RESULT} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('when patchVariant rejects, optimistic update reverts and role="alert" appears', async () => {
    patchVariantMock.mockRejectedValue(new Error('PATCH_500: server error'));
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);

    // Click unselected VARIANT_A — optimistic update fires first
    fireEvent.click(screen.getByText('Sites que convertem'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('PATCH_500: server error');

    // Optimistic update reverted: back to 1 / 2 (only v2 selected)
    expect(screen.getByText('1 / 2 selecionadas')).toBeInTheDocument();

    expect(console.error).toHaveBeenCalledWith(
      '[Review] patchVariant failed',
      expect.any(Error),
    );
  });

  it('warning chip renders on variants with any axis < 0.4', () => {
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);
    // VARIANT_B has all axes < 0.4 — warning chip should appear
    // VARIANT_A has all axes >= 0.4 — no warning chip for it
    const warnings = screen.getAllByText(/eixo fraco/i);
    expect(warnings).toHaveLength(1);
  });

  it('"ver raciocínio" expands to show the reasoning text', () => {
    render(<Review result={AGENT_RESULT} onFinish={vi.fn()} />);

    // Reasoning not visible initially
    expect(screen.queryByText(/Strong PAS fit/)).not.toBeInTheDocument();

    // Click "ver raciocínio" for VARIANT_A (first occurrence)
    const toggleButtons = screen.getAllByRole('button', { name: /ver raciocínio/i });
    fireEvent.click(toggleButtons[0]);

    expect(screen.getByText(/Strong PAS fit porque o produto resolve uma dor clara\./)).toBeInTheDocument();
  });
});
