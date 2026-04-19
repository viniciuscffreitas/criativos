// FlowView — §2.7 error surface + loading state + Setup step render.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';
import { FlowView } from './FlowView';
import type { Brief } from '../types';

const BRIEF: Brief = {
  product: 'Custom websites from €450',
  audience: 'European freelancers',
  pain: 'Losing clients to competitors with real sites',
  ctas: ['Message me'],
  social_proof: '6 sites built last month',
};

describe('FlowView', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading text while brief is pending', () => {
    vi.spyOn(api, 'getBrief').mockReturnValue(new Promise(() => {}));
    render(<FlowView projectSlug="vibeweb" adId="01" onFinish={() => {}} />);
    expect(screen.getByText(/carregando briefing/i)).toBeInTheDocument();
  });

  it('surfaces a role="alert" when loadBrief rejects', async () => {
    vi.spyOn(api, 'getBrief').mockRejectedValueOnce(
      new Error('NOT_FOUND: brief not found'),
    );
    render(<FlowView projectSlug="vibeweb" adId="01" onFinish={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao carregar briefing/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/NOT_FOUND/);
    });
  });

  it('renders the Setup step after brief loads', async () => {
    vi.spyOn(api, 'getBrief').mockResolvedValueOnce(BRIEF);
    render(<FlowView projectSlug="vibeweb" adId="01" onFinish={() => {}} />);
    await waitFor(() => {
      // Step header visible
      expect(screen.getByText('Novo fluxo criativo')).toBeInTheDocument();
      // Setup form present — product field bound to brief value
      expect(screen.getByDisplayValue(BRIEF.product)).toBeInTheDocument();
    });
  });
});
