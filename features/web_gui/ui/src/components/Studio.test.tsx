import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';
import { Studio } from './Studio';

const MANIFEST_PARTIAL = {
  categories: {
    'brand-logos': [
      { category: 'brand-logos', relative_path: 'logos/vibeweb-icon.png', url: '/brand/logos/vibeweb-icon.png', width: 512, height: 512, exists: true },
    ],
    'brand-social': [
      { category: 'brand-social', relative_path: 'social/renders/instagram-post.png', url: '/brand/social/renders/instagram-post.png', width: 1080, height: 1080, exists: false },
    ],
    'brand-favicons': [
      { category: 'brand-favicons', relative_path: 'favicons/favicon-32.png', url: '/brand/favicons/favicon-32.png', width: 32, height: 32, exists: true },
    ],
    'meta-ads': [
      { category: 'meta-ads', relative_path: '01-portfolio-grid.png', url: '/renders/01-portfolio-grid.png', width: 1080, height: 1080, exists: false },
    ],
    'instagram': [
      { category: 'instagram', relative_path: 'single-manifesto.png', url: '/instagram/single-manifesto.png', width: 1080, height: 1350, exists: false },
    ],
  },
};

describe('Studio', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(api, 'getRenderManifest').mockResolvedValue(MANIFEST_PARTIAL);
    vi.spyOn(api, 'renderBrand').mockResolvedValue({
      category: 'brand-pack', ok_count: 3, total: 3, results: [],
      started_at: '', finished_at: '', duration_ms: 1234,
    });
    vi.spyOn(api, 'renderAds').mockResolvedValue({
      category: 'meta-ads', ok_count: 1, total: 1, results: [],
      started_at: '', finished_at: '', duration_ms: 1234,
    });
    vi.spyOn(api, 'renderInstagram').mockResolvedValue({
      category: 'instagram', ok_count: 1, total: 1, results: [],
      started_at: '', finished_at: '', duration_ms: 1234,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the three category sections', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => {
      expect(screen.getByText(/^Marca$/i)).toBeInTheDocument();
      expect(screen.getByText(/Meta Ads/i)).toBeInTheDocument();
      expect(screen.getByText(/^Instagram$/i)).toBeInTheDocument();
    });
  });

  it('shows "pendente" placeholder for assets that do not exist on disk', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => {
      const pending = screen.getAllByText(/pendente/i);
      // 3 pending items: brand-social post, meta-ad, instagram single
      expect(pending.length).toBe(3);
    });
  });

  it('renders thumbnails for assets that exist on disk', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => {
      const imgs = screen.getAllByRole('img');
      // 2 existing assets: vibeweb-icon and favicon-32
      expect(imgs.length).toBe(2);
    });
  });

  it('shows the "X/Y" rendered counter per section', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => {
      // Brand: 2 of 3 rendered (icon + favicon), social pending
      expect(screen.getByTestId('section-counter-brand')).toHaveTextContent('2/3');
      expect(screen.getByTestId('section-counter-meta-ads')).toHaveTextContent('0/1');
      expect(screen.getByTestId('section-counter-instagram')).toHaveTextContent('0/1');
    });
  });

  it('clicking "Gerar marca" calls api.renderBrand and refreshes manifest', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    const button = await screen.findByRole('button', { name: /Gerar marca/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.renderBrand).toHaveBeenCalledTimes(1));
    // Manifest is refetched after a successful render
    await waitFor(() => expect(api.getRenderManifest).toHaveBeenCalledTimes(2));
  });

  it('clicking "Gerar ads" calls api.renderAds (no ad_id filter)', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    const button = await screen.findByRole('button', { name: /Gerar ads/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.renderAds).toHaveBeenCalledWith(undefined));
  });

  it('clicking "Gerar instagram" calls api.renderInstagram (no stem)', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    const button = await screen.findByRole('button', { name: /Gerar instagram/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.renderInstagram).toHaveBeenCalledWith(undefined));
  });

  it('disables the button while rendering', async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.spyOn(api, 'renderBrand').mockReturnValue(
      new Promise(r => { resolve = r as (v: unknown) => void; }) as unknown as ReturnType<typeof api.renderBrand>,
    );
    render(<Studio projectSlug="vibeweb"/>);
    const button = await screen.findByRole('button', { name: /Gerar marca/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Renderizando/i })).toBeDisabled();
    });
    resolve({ category: 'brand-pack', ok_count: 0, total: 0, results: [], started_at: '', finished_at: '', duration_ms: 0 });
  });

  it('surfaces a §2.7 alert when manifest fetch fails', async () => {
    vi.spyOn(api, 'getRenderManifest').mockRejectedValue(new Error('HTTP_500: boom'));
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/HTTP_500: boom/);
    });
  });

  it('surfaces a §2.7 alert when render fails', async () => {
    vi.spyOn(api, 'renderBrand').mockRejectedValue(new Error('HTTP_500: render exploded'));
    render(<Studio projectSlug="vibeweb"/>);
    const button = await screen.findByRole('button', { name: /Gerar marca/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/render exploded/);
    });
  });

  it('renders sub-headings for Logos / Social / Favicons inside Marca', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => {
      // Sub-divisions under "Marca" so the user sees the structure
      // (logos / social / favicons). data-testid keys avoid collision
      // with file paths that contain those words.
      expect(screen.getByTestId('subgroup-brand-logos')).toBeInTheDocument();
      expect(screen.getByTestId('subgroup-brand-social')).toBeInTheDocument();
      expect(screen.getByTestId('subgroup-brand-favicons')).toBeInTheDocument();
    });
  });

  it('renders the conversational prompt at the top', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/pedir pra claude/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('submitting the prompt shows the StudioStream pipeline', async () => {
    // Stub fetch — the streamStudioRequest helper reads it directly.
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(
        'event: run_start\ndata: {"run_id":"r","pipeline_version":"v","started_at":"s"}\n\n' +
        'event: node_start\ndata: {"node_id":"planning","label":"l","start_ms":0}\n\n' +
        'event: done\ndata: {}\n\n',
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    );
    vi.spyOn(global, 'fetch').mockImplementation(fakeFetch);

    render(<Studio projectSlug="vibeweb"/>);
    const ta = await screen.findByPlaceholderText(/pedir pra claude/i);
    fireEvent.change(ta, { target: { value: 'preciso de um anúncio' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    // The pipeline component renders three node labels — assert one of them.
    await waitFor(() =>
      expect(screen.getByText(/Entendendo seu pedido/i)).toBeInTheDocument(),
    );
    // streamStudioRequest must have hit /studio/request
    expect(fakeFetch).toHaveBeenCalledWith(
      '/api/v1/studio/request',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
