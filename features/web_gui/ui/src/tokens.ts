// Mirrors brand/tokens.css — tests/test_tokens_ui_parity.py enforces parity.
//
// Two font groups exist:
//   - Brand fonts (font*Brand): used in rendered creatives and the BrandLibrary
//     showcase. These MUST match brand/tokens.css verbatim (--font-display,
//     --font-body, --font-mono) so the BrandLibrary preview matches the
//     production output.
//   - UI fonts (fontUI, fontUiMono, fontUiDisplay): the webapp's own
//     typography stack — Geist/Geist Mono/Fraunces. These are intentionally
//     different from the brand fonts (this is dashboard chrome, not a
//     creative). They are NOT subject to the parity test.
export const tokens = {
  accent: '#04d361',
  accentDark: '#028a40',
  accentRgb: '4, 211, 97',
  bg: '#0a0a0a',
  text: '#ffffff',
  textMuted: '#a3a3a3',
  border: '#2a2a2a',

  // Brand fonts — match tokens.css.
  fontDisplayBrand: "'Syne', sans-serif",
  fontBodyBrand: "'DM Sans', sans-serif",
  fontMonoBrand: "'Fira Code', monospace",

  // UI fonts — webapp chrome.
  fontUI: '"Geist", "Inter", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, monospace',
  fontDisplay: 'Fraunces, serif',
} as const;
