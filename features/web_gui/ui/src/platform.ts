// Platform detection for keyboard-shortcut display.
//
// The keydown HANDLER (App.tsx) already accepts both metaKey and ctrlKey, so
// the shortcut WORKS on every OS. This module exists only so the rendered
// hint matches the modifier the user actually presses — Mac users see "⌘K",
// Windows / Linux users see "Ctrl+K".
//
// Detection priority:
//   1. navigator.userAgentData.platform (modern Chromium / Edge — clean string)
//   2. navigator.platform (deprecated but supported everywhere)
//
// Anything matching /mac|iphone|ipad|ipod/i is treated as Mac. iOS strings
// are intentionally included: iPad with an external keyboard ships with the
// ⌘ convention, and an iPhone connected to a physical keyboard does the same.

interface UADataPlatform {
  platform: string;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: UADataPlatform;
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithUAData;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

// `key` is the post-modifier glyph: "K", "1", ";", "↵".
export function formatShortcut(key: string): string {
  return isMac() ? `⌘${key}` : `Ctrl+${key}`;
}
