// Platform detection drives keyboard-hint rendering. Tests exercise every
// detection path (userAgentData first, navigator.platform fallback) and pin
// down the iOS-as-Mac choice so we don't regress someone with an iPad +
// external keyboard back to "Ctrl+K".
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { isMac, formatShortcut } from './platform';

const orig = {
  platform: Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform')
    ?? Object.getOwnPropertyDescriptor(navigator, 'platform'),
  uaData: Object.getOwnPropertyDescriptor(navigator, 'userAgentData'),
};

function setPlatform(platform: string, uaDataPlatform?: string) {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(navigator, 'userAgentData', {
    value: uaDataPlatform === undefined ? undefined : { platform: uaDataPlatform },
    configurable: true,
  });
}

beforeEach(() => {
  setPlatform('', undefined);
});

afterEach(() => {
  if (orig.platform) Object.defineProperty(navigator, 'platform', orig.platform);
  if (orig.uaData) Object.defineProperty(navigator, 'userAgentData', orig.uaData);
  else Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
});

describe('isMac', () => {
  it('returns false for empty platform string (no detection signal)', () => {
    // beforeEach already sets platform=''. This pin documents the default
    // contract: when nothing identifies the OS, we render Windows-style hints.
    expect(isMac()).toBe(false);
  });

  it('returns false when navigator is undefined (SSR-safe guard)', () => {
    const origNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
    try {
      expect(isMac()).toBe(false);
    } finally {
      if (origNav) Object.defineProperty(globalThis, 'navigator', origNav);
    }
  });

  it('returns true for MacIntel', () => {
    setPlatform('MacIntel');
    expect(isMac()).toBe(true);
  });

  it('returns true for legacy "Macintosh"', () => {
    setPlatform('Macintosh');
    expect(isMac()).toBe(true);
  });

  it('returns true for iPhone (external-keyboard ⌘ convention)', () => {
    setPlatform('iPhone');
    expect(isMac()).toBe(true);
  });

  it('returns true for iPad', () => {
    setPlatform('iPad');
    expect(isMac()).toBe(true);
  });

  it('returns false for Win32', () => {
    setPlatform('Win32');
    expect(isMac()).toBe(false);
  });

  it('returns false for Linux x86_64', () => {
    setPlatform('Linux x86_64');
    expect(isMac()).toBe(false);
  });

  it('prefers userAgentData.platform over navigator.platform', () => {
    setPlatform('Win32', 'macOS');
    expect(isMac()).toBe(true);
  });

  it('falls back to navigator.platform when userAgentData is undefined', () => {
    setPlatform('MacIntel', undefined);
    expect(isMac()).toBe(true);
  });
});

describe('formatShortcut', () => {
  it('renders ⌘<key> on Mac', () => {
    setPlatform('MacIntel');
    expect(formatShortcut('K')).toBe('⌘K');
    expect(formatShortcut('1')).toBe('⌘1');
    expect(formatShortcut(';')).toBe('⌘;');
    expect(formatShortcut('↵')).toBe('⌘↵');
  });

  it('renders Ctrl+<key> on Windows', () => {
    setPlatform('Win32');
    expect(formatShortcut('K')).toBe('Ctrl+K');
    expect(formatShortcut('1')).toBe('Ctrl+1');
    expect(formatShortcut(';')).toBe('Ctrl+;');
    expect(formatShortcut('↵')).toBe('Ctrl+↵');
  });

  it('renders Ctrl+<key> on Linux', () => {
    setPlatform('Linux x86_64');
    expect(formatShortcut('K')).toBe('Ctrl+K');
  });
});
