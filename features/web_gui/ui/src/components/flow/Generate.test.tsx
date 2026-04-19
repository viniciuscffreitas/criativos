// Generate — SSE event handling tests (§2.7 error surface, §2.8 AI-UX traces).
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentResult, CopyVariant } from '../../types';

const abort = vi.fn();
let emit: ((e: unknown) => void) | null = null;
const streamGenerateMock = vi.fn((_payload: unknown, onEvent: (e: unknown) => void) => {
  emit = onEvent;
  return abort;
});

vi.mock('../../api', () => ({ streamGenerate: streamGenerateMock }));

const { Generate } = await import('./Generate');

// ── Fixtures ───────────────────────────────────────────────────────────────────

const BASE_PROPS = {
  projectSlug: 'vibeweb',
  adId: '01',
  methodology: 'pas',
  nVariants: 2,
  onDone: vi.fn(),
};

const VARIANT: CopyVariant = {
  id: 'v1',
  headline: 'Sites que convertem',
  primary_text: 'Texto principal',
  description: 'Descrição',
  ctas: ['Saiba mais'],
  confidence: 'high',
  confidence_score: 0.9,
  axes: { relevance: 0.9, originality: 0.8, brand_fit: 0.85 },
  reasoning: 'Strong PAS fit',
  selected: false,
  confidence_symbol: '✅',
};

const AGENT_RESULT: AgentResult = {
  run_id: 'run-abc123',
  variants: [VARIANT],
  trace: 'trace text',
  trace_structured: [],
  methodology: 'pas',
  model: 'claude-sonnet-4-6',
  pipeline_version: '1.0.0',
  seed: null,
  created_at: '2026-04-19T10:00:00Z',
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Generate', () => {
  beforeEach(() => {
    emit = null;
    abort.mockClear();
    BASE_PROPS.onDone.mockClear();
    streamGenerateMock.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders header with methodology and nVariants', () => {
    render(<Generate {...BASE_PROPS} />);
    expect(screen.getByText(/etapa 2 · geração/i)).toBeInTheDocument();
    // variant strip shows 0 / nVariants
    expect(screen.getByText(/0 \/ 2 variantes/i)).toBeInTheDocument();
    // methodology label visible in node panel header
    expect(screen.getByText(/pipeline · pas/i)).toBeInTheDocument();
  });

  it('appends tokens as "token" events arrive', () => {
    render(<Generate {...BASE_PROPS} />);
    act(() => {
      emit!({ type: 'token', payload: { node_id: 'n1', variant_id: 'v1', text: 'Olá ' } });
      emit!({ type: 'token', payload: { node_id: 'n1', variant_id: 'v1', text: 'mundo' } });
    });
    expect(screen.getByText('Olá mundo')).toBeInTheDocument();
  });

  it('adds a variant chip when "variant_done" fires', () => {
    render(<Generate {...BASE_PROPS} />);
    act(() => {
      emit!({ type: 'variant_done', payload: VARIANT });
    });
    expect(screen.getByText(/1 \/ 2 variantes/i)).toBeInTheDocument();
    // confidence_symbol chip rendered
    expect(screen.getAllByText('✅').length).toBeGreaterThan(0);
  });

  it('calls onDone with AgentResult when "done" event fires', () => {
    render(<Generate {...BASE_PROPS} />);
    act(() => {
      emit!({ type: 'done', payload: AGENT_RESULT });
    });
    expect(BASE_PROPS.onDone).toHaveBeenCalledOnce();
    expect(BASE_PROPS.onDone).toHaveBeenCalledWith(AGENT_RESULT);
  });

  it('surfaces role="alert" when "error" event fires', () => {
    render(<Generate {...BASE_PROPS} />);
    act(() => {
      emit!({ type: 'error', payload: { code: 'NO_BODY', error: 'SSE response has no body' } });
    });
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('NO_BODY');
    expect(alert).toHaveTextContent('SSE response has no body');
    expect(console.error).toHaveBeenCalledWith(
      '[Generate] stream error',
      expect.objectContaining({ code: 'NO_BODY' }),
    );
  });

  it('calls the returned abort function on unmount', () => {
    const { unmount } = render(<Generate {...BASE_PROPS} />);
    unmount();
    expect(abort).toHaveBeenCalledOnce();
  });
});
