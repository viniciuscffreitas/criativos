import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';
import { Gallery } from './Gallery';
import type { Creative } from '../types';

function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 'portfolio-grid-base',
    kind: 'image',
    title: 'Portfolio Grid',
    placement: 'IG Feed',
    format: '1080×1080 png',
    headline: 'H',
    body: 'B',
    hero: 'hero',
    ctas: ['Click'],
    thumbnail_url: '',
    status: 'ready',
    ad_id: '01',
    variant_id: null,
    last_run_id: null,
    ...overrides,
  };
}

describe('Gallery — ver trace wiring', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hover "ver trace" button does NOT render when last_run_id is null', async () => {
    vi.spyOn(api, 'listCreatives').mockResolvedValueOnce({
      creatives: [makeCreative({ last_run_id: null })],
    });
    render(<Gallery projectSlug="vibeweb" onOpenCreative={() => {}} onOpenTrace={() => {}} />);
    const card = await screen.findByTestId('creative-card');
    fireEvent.mouseEnter(card);
    expect(screen.queryByRole('button', { name: /ver trace/i })).not.toBeInTheDocument();
  });

  it('hover "ver trace" button renders and calls onOpenTrace(run_id) when last_run_id is present', async () => {
    const onOpenTrace = vi.fn();
    vi.spyOn(api, 'listCreatives').mockResolvedValueOnce({
      creatives: [makeCreative({ last_run_id: 'run-abc-123' })],
    });
    render(<Gallery projectSlug="vibeweb" onOpenCreative={() => {}} onOpenTrace={onOpenTrace} />);
    const card = await screen.findByTestId('creative-card');
    fireEvent.mouseEnter(card);
    const btn = await waitFor(() => screen.getByRole('button', { name: /ver trace/i }));
    fireEvent.click(btn);
    expect(onOpenTrace).toHaveBeenCalledWith('run-abc-123');
  });

  it('clicking "ver trace" does NOT also trigger onOpenCreative (stopPropagation)', async () => {
    const onOpenCreative = vi.fn();
    const onOpenTrace = vi.fn();
    vi.spyOn(api, 'listCreatives').mockResolvedValueOnce({
      creatives: [makeCreative({ last_run_id: 'run-xyz' })],
    });
    render(<Gallery projectSlug="vibeweb" onOpenCreative={onOpenCreative} onOpenTrace={onOpenTrace} />);
    const card = await screen.findByTestId('creative-card');
    fireEvent.mouseEnter(card);
    const btn = await waitFor(() => screen.getByRole('button', { name: /ver trace/i }));
    fireEvent.click(btn);
    expect(onOpenTrace).toHaveBeenCalledTimes(1);
    expect(onOpenCreative).not.toHaveBeenCalled();
  });
});
