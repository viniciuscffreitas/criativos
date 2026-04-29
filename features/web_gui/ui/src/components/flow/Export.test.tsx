// Export — preview PNG, selected variants summary, download link, finish action.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentResult, CopyVariant } from '../../types';
import { Export } from './Export';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const VARIANT_SEL: CopyVariant = {
  id: 'v1',
  headline: 'Sites que convertem',
  primary_text: 'Texto principal da variante selecionada.',
  description: 'Descrição A',
  ctas: ['Saiba mais'],
  confidence: 'high',
  confidence_score: 0.9,
  axes: { relevance: 0.9, originality: 0.8, brand_fit: 0.85 },
  reasoning: 'Strong fit',
  selected: true,
  confidence_symbol: '✅',
};

const VARIANT_UNSEL: CopyVariant = {
  id: 'v2',
  headline: 'Design que vende',
  primary_text: 'Texto principal da variante não selecionada.',
  description: 'Descrição B',
  ctas: ['Fale connosco'],
  confidence: 'low',
  confidence_score: 0.3,
  axes: { relevance: 0.3, originality: 0.2, brand_fit: 0.35 },
  reasoning: 'Weak fit',
  selected: false,
  confidence_symbol: '🔴',
};

const AGENT_RESULT: AgentResult = {
  run_id: 'run-export-001',
  variants: [VARIANT_SEL, VARIANT_UNSEL],
  trace: 'trace text',
  trace_structured: [],
  methodology: 'pas',
  model: 'claude-sonnet-4-6',
  pipeline_version: '1.0.0',
  seed: null,
  created_at: '2026-04-19T10:00:00Z',
};

const BASE_PROPS = {
  projectSlug: 'vibeweb',
  adId: '01',
  result: AGENT_RESULT,
  onFinish: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Export', () => {
  beforeEach(() => {
    BASE_PROPS.onFinish.mockClear();
  });

  it('renders "etapa 4 · export" header', () => {
    render(<Export {...BASE_PROPS} />);
    expect(screen.getByText(/etapa 4 · export/i)).toBeInTheDocument();
  });

  it('shows singular "1 variante selecionada" when exactly one is selected', () => {
    render(<Export {...BASE_PROPS} />);
    // Only VARIANT_SEL has selected:true → 1
    expect(screen.getByText('1 variante selecionada')).toBeInTheDocument();
  });

  it('PNG <img> has correct src /renders/{adId}-{slug}.png', () => {
    render(<Export {...BASE_PROPS} />);
    const img = screen.getByRole('img', { name: 'ad preview' });
    expect(img).toHaveAttribute('src', '/renders/01-vibeweb.png');
  });

  it('"Baixar PNG" anchor has download attr + correct href', () => {
    render(<Export {...BASE_PROPS} />);
    const link = screen.getByRole('link', { name: /baixar png/i });
    expect(link).toHaveAttribute('href', '/renders/01-vibeweb.png');
    expect(link).toHaveAttribute('download');
  });

  it('"Concluir" button calls onFinish', () => {
    render(<Export {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }));
    expect(BASE_PROPS.onFinish).toHaveBeenCalledOnce();
  });

  it('"Publicar no Meta" button is disabled', () => {
    render(<Export {...BASE_PROPS} />);
    expect(screen.getByRole('button', { name: /publicar no meta/i })).toBeDisabled();
  });
});
