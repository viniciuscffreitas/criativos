import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AssetCardRich, describeAsset } from './AssetCardRich';
import type { RenderManifestItem } from '../types';

const item = (overrides: Partial<RenderManifestItem> = {}): RenderManifestItem => ({
  category: 'meta-ads',
  relative_path: '01-portfolio-grid.png',
  url: '/renders/01-portfolio-grid.png',
  width: 1080,
  height: 1080,
  exists: true,
  ...overrides,
});

describe('describeAsset', () => {
  it('describes a Meta Ad with size + 1:1 ratio', () => {
    const out = describeAsset(item());
    expect(out).toMatch(/Meta Ad/i);
    expect(out).toMatch(/1080×1080/);
    expect(out).toMatch(/quadrado/i);
  });

  it('uses landscape descriptor for wide assets', () => {
    expect(describeAsset(item({ width: 1584, height: 396 }))).toMatch(/horizontal/i);
  });

  it('uses portrait descriptor for tall assets', () => {
    expect(describeAsset(item({ width: 1080, height: 1920 }))).toMatch(/vertical/i);
  });

  it('describes brand-favicons with the favicon role', () => {
    expect(describeAsset(item({
      category: 'brand-favicons',
      relative_path: 'favicons/icon-512.png',
      width: 512, height: 512,
    }))).toMatch(/favicon/i);
  });

  it('describes brand-logos with the logo role', () => {
    expect(describeAsset(item({
      category: 'brand-logos',
      relative_path: 'logos/vibeweb-icon.png',
      width: 512, height: 512,
    }))).toMatch(/logo/i);
  });

  it('describes Instagram singles with the post sub-category', () => {
    expect(describeAsset(item({
      category: 'instagram',
      relative_path: 'single-manifesto.png',
      width: 1080, height: 1350,
    }))).toMatch(/Instagram.*Post/i);
  });

  it('describes Instagram carousels', () => {
    expect(describeAsset(item({
      category: 'instagram',
      relative_path: 'carousel-portfolio-slide-1.png',
      width: 1080, height: 1350,
    }))).toMatch(/Carrossel/i);
  });

  it('describes Instagram highlight covers', () => {
    expect(describeAsset(item({
      category: 'instagram',
      relative_path: 'highlight-cover-portfolio.png',
      width: 1080, height: 1920,
    }))).toMatch(/Capa/i);
  });

  it('describes Instagram story starters', () => {
    expect(describeAsset(item({
      category: 'instagram',
      relative_path: 'story-starter-services-1.png',
      width: 1080, height: 1920,
    }))).toMatch(/Story/i);
  });
});

describe('AssetCardRich hover', () => {
  it('renders the tooltip text after mouseenter', () => {
    render(<AssetCardRich item={item()} reloadKey={0}/>);
    const card = screen.getByTestId('asset-card');
    fireEvent.mouseEnter(card);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Meta Ad/i);
  });

  it('hides the tooltip after mouseleave', () => {
    render(<AssetCardRich item={item()} reloadKey={0}/>);
    const card = screen.getByTestId('asset-card');
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not crash on pendente (exists=false) cards', () => {
    render(<AssetCardRich item={item({ exists: false })} reloadKey={0}/>);
    expect(screen.getByText(/pendente/i)).toBeInTheDocument();
  });

  it('renders the thumbnail image when exists=true', () => {
    render(<AssetCardRich item={item()} reloadKey={5}/>);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('/renders/01-portfolio-grid.png');
    expect(img.src).toContain('v=5');
  });
});
