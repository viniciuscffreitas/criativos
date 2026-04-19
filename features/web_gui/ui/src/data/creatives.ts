import { api } from '../api';
import type { Creative } from '../types';
export async function fetchCreatives(slug: string, kind?: string): Promise<Creative[]> {
  const r = await api.listCreatives(slug, kind);
  return r.creatives;
}
