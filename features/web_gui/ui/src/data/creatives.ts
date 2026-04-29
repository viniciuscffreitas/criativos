import { api } from '../api';
import type { Creative } from '../types';

// Fetches the full creative list for a project. `kind` filtering is applied
// client-side in Gallery; delegate to `api.listCreatives(slug, kind)` directly
// when/if server-side filtering becomes necessary.
export async function fetchCreatives(slug: string): Promise<Creative[]> {
  const r = await api.listCreatives(slug);
  return r.creatives;
}
