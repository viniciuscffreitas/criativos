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
    render(<BrandLibrary projectSlug="otherproject" />);
    expect(screen.getByText('otherproject')).toBeInTheDocument();
  });
});

describe('BrandLibrary — palette edit (confirm-modal flow)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders an "Editar X" trigger button for each swatch', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(screen.getByRole('button', { name: /^Editar Accent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar Background/i })).toBeInTheDocument();
  });

  it('clicking a swatch opens a confirm dialog (does NOT live-apply)', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Accent$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Editing inside the dialog does NOT immediately persist.
    expect(localStorage.getItem('cr_palette_draft')).toBeNull();
  });

  it('cancelling the swatch dialog does NOT persist', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Accent$/i }));
    const dialogPicker = screen.getByLabelText(/^Nova cor$/i) as HTMLInputElement;
    fireEvent.input(dialogPicker, { target: { value: '#ff00aa' } });
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(localStorage.getItem('cr_palette_draft')).toBeNull();
  });

  it('confirming the swatch dialog persists the new color', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Accent$/i }));
    const dialogPicker = screen.getByLabelText(/^Nova cor$/i) as HTMLInputElement;
    fireEvent.input(dialogPicker, { target: { value: '#ff00aa' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    const draft = JSON.parse(localStorage.getItem('cr_palette_draft') ?? '{}');
    expect(draft.accent).toBe('#ff00aa');
  });

  it('restores the draft palette on mount and shows it on the swatch', () => {
    localStorage.setItem('cr_palette_draft', JSON.stringify({ accent: '#abcdef' }));
    render(<BrandLibrary projectSlug="vibeweb" />);
    // Hex chip on the swatch button reflects the draft
    const accentBtn = screen.getByRole('button', { name: /^Editar Accent$/i });
    expect(accentBtn.textContent).toMatch(/#abcdef/i);
  });

  it('shows "Resetar paleta" button only when a draft exists', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(screen.queryByRole('button', { name: /Resetar paleta/i })).toBeNull();
    // Edit one swatch
    fireEvent.click(screen.getByRole('button', { name: /^Editar Accent$/i }));
    fireEvent.input(screen.getByLabelText(/^Nova cor$/i), { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(screen.getByRole('button', { name: /Resetar paleta/i })).toBeInTheDocument();
  });

  it('clicking "Resetar paleta" clears the draft', () => {
    localStorage.setItem('cr_palette_draft', JSON.stringify({ accent: '#abcdef' }));
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /Resetar paleta/i }));
    expect(localStorage.getItem('cr_palette_draft')).toBeNull();
    const accentBtn = screen.getByRole('button', { name: /^Editar Accent$/i });
    expect(accentBtn.textContent).toMatch(/#04d361/i);
  });
});

describe('BrandLibrary — typography edit (confirm-modal flow)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clicking a font card opens a confirm dialog', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Display$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Editar Display/i)).toBeInTheDocument();
    expect(localStorage.getItem('cr_typography_draft')).toBeNull();
  });

  it('cancelling typography dialog does NOT persist', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Display$/i }));
    const input = screen.getByLabelText(/^Nova fonte$/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Inter' } });
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(localStorage.getItem('cr_typography_draft')).toBeNull();
  });

  it('confirming typography dialog persists the new font family', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Display$/i }));
    const input = screen.getByLabelText(/^Nova fonte$/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Inter' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    const draft = JSON.parse(localStorage.getItem('cr_typography_draft') ?? '{}');
    expect(draft.display).toBe('Inter');
  });

  it('clicking a suggestion chip fills the input', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('button', { name: /^Editar Display$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Inter$/ }));
    const input = screen.getByLabelText(/^Nova fonte$/i) as HTMLInputElement;
    expect(input.value).toBe('Inter');
  });

  it('shows "Resetar tipografia" only when a draft exists', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(screen.queryByRole('button', { name: /Resetar tipografia/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Editar Display$/i }));
    fireEvent.change(screen.getByLabelText(/^Nova fonte$/i), { target: { value: 'Inter' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(screen.getByRole('button', { name: /Resetar tipografia/i })).toBeInTheDocument();
  });
});

describe('BrandLibrary — uploads (list + select + delete)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows empty-state when there are no uploads', async () => {
    vi.spyOn(api, 'listAssets').mockResolvedValueOnce({ assets: [] });
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(await screen.findByText(/Nenhum ativo enviado/i)).toBeInTheDocument();
  });

  it('renders one card per uploaded asset', async () => {
    vi.spyOn(api, 'listAssets').mockResolvedValueOnce({
      assets: [
        { file_id: 'a'.repeat(32), filename: 'banner.png', size: 1024, kind: 'image' },
        { file_id: 'b'.repeat(32), filename: 'icon.svg',   size:  256, kind: 'logo'  },
      ],
    });
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(await screen.findByText('banner.png')).toBeInTheDocument();
    expect(screen.getByText('icon.svg')).toBeInTheDocument();
  });

  it('selecting an upload via checkbox shows the global selection toolbar', async () => {
    vi.spyOn(api, 'listAssets').mockResolvedValueOnce({
      assets: [
        { file_id: 'a'.repeat(32), filename: 'banner.png', size: 1024, kind: 'image' },
        { file_id: 'b'.repeat(32), filename: 'icon.svg',   size:  256, kind: 'logo'  },
      ],
    });
    render(<BrandLibrary projectSlug="vibeweb" />);
    const banner = await screen.findByRole('checkbox', { name: /Selecionar banner\.png/i });
    const icon   = await screen.findByRole('checkbox', { name: /Selecionar icon\.svg/i });
    expect(screen.queryByRole('button', { name: /^Excluir$/i })).toBeNull();
    fireEvent.click(banner);
    expect(screen.getByRole('button', { name: /^Excluir$/i })).toBeInTheDocument();
    expect(screen.getByText(/^1 selecionado$/i)).toBeInTheDocument();
    fireEvent.click(icon);
    expect(screen.getByText(/^2 selecionados$/i)).toBeInTheDocument();
  });

  it('clicking Excluir confirms then calls deleteAsset for each selected id', async () => {
    vi.spyOn(api, 'listAssets')
      .mockResolvedValueOnce({
        assets: [
          { file_id: 'a'.repeat(32), filename: 'banner.png', size: 1024, kind: 'image' },
          { file_id: 'b'.repeat(32), filename: 'icon.svg',   size:  256, kind: 'logo'  },
        ],
      })
      .mockResolvedValueOnce({ assets: [] });
    const deleteSpy = vi.spyOn(api, 'deleteAsset').mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Selecionar banner\.png/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Selecionar icon\.svg/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Excluir$/i }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });
    expect(deleteSpy).toHaveBeenCalledWith('vibeweb', 'a'.repeat(32));
    expect(deleteSpy).toHaveBeenCalledWith('vibeweb', 'b'.repeat(32));
  });

  it('cancelling the confirm leaves uploads intact', async () => {
    vi.spyOn(api, 'listAssets').mockResolvedValueOnce({
      assets: [{ file_id: 'a'.repeat(32), filename: 'banner.png', size: 1024, kind: 'image' }],
    });
    const deleteSpy = vi.spyOn(api, 'deleteAsset');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Selecionar banner\.png/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Excluir$/i }));

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

describe('BrandLibrary — canonical asset selection + delete', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(api, 'listAssets').mockResolvedValue({ assets: [] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a checkbox on each canonical brand asset card', () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    // The Logos section has at least one canonical card with a checkbox.
    expect(
      screen.getByRole('checkbox', { name: /selecionar.*vibeweb-primary\.svg/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /selecionar.*instagram-post\.png/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /selecionar.*favicon-32\.png/i })
    ).toBeInTheDocument();
  });

  it('selecting a canonical asset shows the global selection toolbar', async () => {
    render(<BrandLibrary projectSlug="vibeweb" />);
    const cb = screen.getByRole('checkbox', { name: /selecionar.*vibeweb-primary\.svg/i });
    fireEvent.click(cb);
    expect(await screen.findByText(/^1 selecionado$/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Excluir$/i }).length).toBeGreaterThan(0);
  });

  it('confirming Excluir on a canonical asset calls api.deleteBrandFile', async () => {
    const spy = vi.spyOn(api, 'deleteBrandFile').mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BrandLibrary projectSlug="vibeweb" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar.*instagram-post\.png/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Excluir$/i })[0]);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith('social/renders/instagram-post.png');
  });

  it('after delete, the canonical asset card disappears', async () => {
    vi.spyOn(api, 'deleteBrandFile').mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BrandLibrary projectSlug="vibeweb" />);
    expect(screen.getByText('vibeweb-primary.svg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar.*vibeweb-primary\.svg/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Excluir$/i })[0]);
    await waitFor(() => {
      expect(screen.queryByText('vibeweb-primary.svg')).toBeNull();
    });
  });

  it('mixed selection (upload + canonical) calls both endpoints', async () => {
    vi.spyOn(api, 'listAssets').mockResolvedValue({
      assets: [{ file_id: 'a'.repeat(32), filename: 'mine.png', size: 100, kind: 'image' }],
    });
    const uploadSpy = vi.spyOn(api, 'deleteAsset').mockResolvedValue(undefined);
    const brandSpy = vi.spyOn(api, 'deleteBrandFile').mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrandLibrary projectSlug="vibeweb" />);
    // Wait for upload list to load
    await screen.findByText('mine.png');
    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar mine\.png/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar.*vibeweb-icon\.svg/i }));
    expect(await screen.findByText(/^2 selecionados$/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /^Excluir$/i })[0]);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(brandSpy).toHaveBeenCalledTimes(1);
    });
    expect(uploadSpy).toHaveBeenCalledWith('vibeweb', 'a'.repeat(32));
    expect(brandSpy).toHaveBeenCalledWith('logos/vibeweb-icon.svg');
  });
});
