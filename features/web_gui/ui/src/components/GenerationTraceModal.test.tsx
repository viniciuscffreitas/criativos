// GenerationTraceModal — loads trace, renders node graph + raw CoT, surfaces errors.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentResult } from '../types';

// ESM mock — must be declared before dynamic import
vi.mock('../api', () => ({
  api: {
    getTrace: vi.fn(),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TRACE_RESULT: AgentResult = {
  run_id: 'run-trace-001',
  variants: [
    {
      id: 'v1', headline: 'H1', primary_text: 'PT1', description: 'D1',
      ctas: [], confidence: 'high', confidence_score: 0.9,
      axes: { relevance: 0.9, originality: 0.8, brand_fit: 0.85 },
      reasoning: 'R1', selected: true, confidence_symbol: '✅',
    },
  ],
  trace: 'step 1: analyse brief\nstep 2: generate copy',
  trace_structured: [
    { id: 'n1', label: 'AnalyseBrief', start_ms: 0, end_ms: 120, tokens: 40, confidence: 0.9, output_preview: 'ok' },
    { id: 'n2', label: 'GenerateCopy', start_ms: 120, end_ms: 480, tokens: 200, confidence: 0.8, output_preview: 'ok' },
  ],
  methodology: 'pas',
  model: 'claude-sonnet-4-6',
  pipeline_version: '1.0.0',
  seed: null,
  created_at: '2026-04-19T10:00:00Z',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function importModal() {
  const mod = await import('./GenerationTraceModal');
  return mod.GenerationTraceModal;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GenerationTraceModal', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns null when runId is null', async () => {
    const { api } = await import('../api');
    vi.mocked(api.getTrace).mockResolvedValue(TRACE_RESULT);
    const GenerationTraceModal = await importModal();
    const { container } = render(
      <GenerationTraceModal runId={null} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading text while getTrace is pending', async () => {
    const { api } = await import('../api');
    vi.mocked(api.getTrace).mockReturnValue(new Promise(() => {}));
    const GenerationTraceModal = await importModal();
    render(<GenerationTraceModal runId="run-trace-001" onClose={() => {}} />);
    expect(screen.getByText(/carregando trace/i)).toBeInTheDocument();
  });

  it('renders node labels from trace_structured + raw trace text on success', async () => {
    const { api } = await import('../api');
    vi.mocked(api.getTrace).mockResolvedValue(TRACE_RESULT);
    const GenerationTraceModal = await importModal();
    render(<GenerationTraceModal runId="run-trace-001" onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('AnalyseBrief')).toBeInTheDocument();
      expect(screen.getByText('GenerateCopy')).toBeInTheDocument();
      expect(screen.getByText(/step 1: analyse brief/i)).toBeInTheDocument();
    });
  });

  it('shows role="alert" with error message when getTrace rejects', async () => {
    const { api } = await import('../api');
    vi.mocked(api.getTrace).mockRejectedValue(new Error('HTTP_500: trace not found'));
    const GenerationTraceModal = await importModal();
    render(<GenerationTraceModal runId="run-trace-001" onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/HTTP_500: trace not found/);
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[GenerationTraceModal]'),
      expect.any(Error),
    );
  });
});
