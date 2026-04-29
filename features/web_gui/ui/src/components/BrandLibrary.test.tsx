import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';
import { BrandLibrary } from './BrandLibrary';

function pngFile(name = 'logo.png', bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

describe('BrandLibrary — upload wiring', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicking "Subir ativo" opens the hidden file input', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    const input = screen.getByTestId('brand-upload-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /subir ativo/i }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('selecting valid files calls api.uploadAssets with the active project slug', async () => {
    const spy = vi.spyOn(api, 'uploadAssets').mockResolvedValueOnce({
      uploaded: [{ file_id: 'f1', filename: 'logo.png', size: 64, kind: 'image/png' }],
    });
    render(<BrandLibrary projectSlug="vibeweb" />);
    const input = screen.getByTestId('brand-upload-input') as HTMLInputElement;
    const file = pngFile();
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const [slug, files] = spy.mock.calls[0];
    expect(slug).toBe('vibeweb');
    expect(files[0].name).toBe('logo.png');
  });

  it('shows uploading state while api.uploadAssets is pending, then success', async () => {
    let resolveUpload!: (v: unknown) => void;
    vi.spyOn(api, 'uploadAssets').mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );
    render(<BrandLibrary projectSlug="vibeweb" />);
    const input = screen.getByTestId('brand-upload-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    expect(await screen.findByText(/enviando/i)).toBeInTheDocument();
    resolveUpload({ uploaded: [{ file_id: 'f1', filename: 'logo.png', size: 64, kind: 'image/png' }] });
    expect(await screen.findByText(/1 ativo enviado/i)).toBeInTheDocument();
  });

  it('surfaces a role="alert" when api.uploadAssets rejects', async () => {
    vi.spyOn(api, 'uploadAssets').mockRejectedValueOnce(
      new Error('UNSUPPORTED_MEDIA_TYPE: file "x.exe" has unsupported content type'),
    );
    render(<BrandLibrary projectSlug="vibeweb" />);
    const input = screen.getByTestId('brand-upload-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/unsupported/i);
  });

  it('rejects client-side when file exceeds 10 MB without calling the API', async () => {
    const spy = vi.spyOn(api, 'uploadAssets');
    render(<BrandLibrary projectSlug="vibeweb" />);
    const input = screen.getByTestId('brand-upload-input') as HTMLInputElement;
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [big] } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/10 ?mb/i);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('BrandLibrary — real assets (no mock placeholders)', () => {
  it('does NOT render the Claude-AI-design fictional product placeholders', () => {
    // Old version had hardcoded "X3 Coral / X3 Preto / X3 Areia" + lifestyle
    // gradients ("Urbano · pôr do sol", etc) — pure mock data unrelated to
    // the actual brand. Removed.
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(screen.queryByText(/X3 Coral/i)).toBeNull();
    expect(screen.queryByText(/X3 Preto/i)).toBeNull();
    expect(screen.queryByText(/X3 Areia/i)).toBeNull();
    expect(screen.queryByText(/pôr do sol/i)).toBeNull();
    expect(screen.queryByText(/Asfalto · noite/i)).toBeNull();
  });

  it('renders the real logo SVGs from /brand/logos/', () => {
    const { container } = render(<BrandLibrary projectSlug="vibeweb" />);
    const imgs = Array.from(container.querySelectorAll('img'));
    const logoSrcs = imgs.map(i => i.getAttribute('src') ?? '');
    expect(logoSrcs).toContain('/brand/logos/vibeweb-primary.svg');
    expect(logoSrcs).toContain('/brand/logos/vibeweb-icon.svg');
    expect(logoSrcs).toContain('/brand/logos/vibeweb-stacked.svg');
    expect(logoSrcs).toContain('/brand/logos/vibeweb-wordmark.svg');
  });

  it('renders the social brand renders from /brand/social/renders/', () => {
    const { container } = render(<BrandLibrary projectSlug="vibeweb" />);
    const srcs = Array.from(container.querySelectorAll('img'))
      .map(i => i.getAttribute('src') ?? '');
    expect(srcs).toContain('/brand/social/renders/instagram-post.png');
    expect(srcs).toContain('/brand/social/renders/instagram-story.png');
    expect(srcs).toContain('/brand/social/renders/linkedin-banner.png');
    expect(srcs).toContain('/brand/social/renders/og-image.png');
  });

  it('renders the favicons', () => {
    const { container } = render(<BrandLibrary projectSlug="vibeweb" />);
    const srcs = Array.from(container.querySelectorAll('img'))
      .map(i => i.getAttribute('src') ?? '');
    expect(srcs).toContain('/brand/favicons/icon-512.png');
    expect(srcs).toContain('/brand/favicons/apple-touch-icon.png');
  });

  it('shows the BRAND fonts (Syne / DM Sans / Fira Code), not the UI fonts', () => {
    // Old version listed Geist / Geist Mono / Fraunces (the webapp's own
    // chrome typography) as if they were the brand fonts. The brand uses
    // Syne (display) + DM Sans (body) + Fira Code (mono) — see
    // brand/tokens.css. The webapp chrome fonts are intentionally different
    // and are NOT shown in the BrandLibrary preview.
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(screen.getByText('Syne')).toBeInTheDocument();
    expect(screen.getByText('DM Sans')).toBeInTheDocument();
    expect(screen.getByText('Fira Code')).toBeInTheDocument();
    // Old fictitious labels gone
    expect(screen.queryByText(/^Geist$/)).toBeNull();
    expect(screen.queryByText(/^Fraunces$/)).toBeNull();
  });

  it('shows the active project slug, not a hardcoded one', () => {
    // Old version hardcoded "Vibe Web" badge. Now the badge mirrors the
    // projectSlug prop so multi-project setups won't show stale label.
    render(<BrandLibrary projectSlug="otherproject" />);
    expect(screen.getByText('otherproject')).toBeInTheDocument();
  });
});
