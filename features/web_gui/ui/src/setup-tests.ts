import '@testing-library/jest-dom';

// Node 22+ ships an experimental `localStorage` global without `getItem` when
// `--experimental-localstorage-file` is set without a path. That global takes
// precedence over jsdom's Storage, breaking components that read localStorage.
// Replace with a minimal in-memory Storage for tests.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(window, 'localStorage', { value: globalThis.localStorage, configurable: true });
