// Setup — narrow tests for the platform-aware "Próximo" shortcut hint.
// The full Setup form is exercised end-to-end via test_ui_e2e.py; this file
// covers only the platform branch which is jsdom-friendly.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Setup } from './Setup';
import type { Brief } from '../../types';

function setPlatform(platform: string) {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
}

const BRIEF: Brief = {
  product: 'Vibe Web',
  audience: 'Agências',
  pain_point: '',
  promise: '',
  proof: '',
  cta_headline: '',
  ctas: [],
};

const BASE_PROPS = {
  projectSlug: 'vibeweb',
  adId: '01',
  brief: BRIEF,
  onChangeBrief: () => {},
  onNext: () => {},
  nVariants: 2,
  setNVariants: () => {},
  methodology: 'pas' as const,
  setMethodology: () => {},
};

describe('Setup — Próximo button shortcut hint', () => {
  beforeEach(() => { setPlatform(''); });
  afterEach(() => { setPlatform(''); });

  it('renders ⌘↵ on Mac', () => {
    setPlatform('MacIntel');
    render(<Setup {...BASE_PROPS} />);
    expect(screen.getByText('⌘↵')).toBeInTheDocument();
  });

  it('renders Ctrl+↵ on Windows', () => {
    setPlatform('Win32');
    render(<Setup {...BASE_PROPS} />);
    expect(screen.getByText('Ctrl+↵')).toBeInTheDocument();
    expect(screen.queryByText('⌘↵')).toBeNull();
  });
});
