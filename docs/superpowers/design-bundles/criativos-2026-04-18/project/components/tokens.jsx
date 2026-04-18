// Design tokens — single source of truth.
// Rule of thumb:
//   • 4 type sizes: 11 (micro), 12 (meta), 13 (body), 15+ (headings)
//   • 4 radii: 4 (chip), 6 (control), 8 (card), 12 (panel)
//   • All text on white meets WCAG AA (4.5:1 body, 3:1 large).

const T = {
  // Neutral scale (stone)
  ink:        '#1c1917', // 16.9:1 on white — primary text
  ink2:       '#44403c', // 9.8:1  — secondary text
  muted:      '#6f6a64', // 5.2:1  — tertiary text (replaces #78716c for safety on white)
  hint:       '#8a847d', // 3.6:1  — LARGE text / icon only (NOT body)
  line:       '#e7e5e4', // borders
  line2:      '#d6d3d1', // stronger border
  surface:    '#fafaf9',
  surface2:   '#f5f5f4',
  white:      '#ffffff',

  // Semantic — muted, not saturated
  success:    'oklch(0.52 0.12 150)', // AA on white
  successBg:  'oklch(0.96 0.04 150)',
  warn:       'oklch(0.5 0.14 70)',
  warnBg:     'oklch(0.97 0.05 70)',
  danger:     'oklch(0.5 0.18 25)',
  dangerBg:   'oklch(0.96 0.04 25)',
  accent:     'oklch(0.55 0.18 25)', // brand orange

  // Typography
  fontUI:     '"Geist", "Inter", system-ui, sans-serif',
  fontMono:   '"Geist Mono", ui-monospace, monospace',
  fontDisplay:'Fraunces, serif',

  // Type scale (px)
  t11: 11, t12: 12, t13: 13, t15: 15, t18: 18, t22: 22, t28: 28,

  // Radii
  r4: 4, r6: 6, r8: 8, r12: 12,

  // Spacing (4px grid)
  s4: 4, s8: 8, s12: 12, s16: 16, s20: 20, s24: 24, s32: 32,
};

// Utility: consistent "caption" style (replaces scattered uppercase/mono micro-labels)
const captionStyle = {
  fontSize: T.t11, color: T.muted, fontWeight: 500,
  letterSpacing: 0, textTransform: 'none',
  fontFamily: T.fontUI,
};

// Utility: monospace tag (for IDs, counts, timings — NOT for section labels)
const monoTag = {
  fontFamily: T.fontMono, fontSize: T.t11, color: T.muted,
};

Object.assign(window, { T, captionStyle, monoTag });
