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
