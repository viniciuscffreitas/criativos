import { api } from '../api';
import type { Brief } from '../types';

export async function loadBrief(slug: string, adId: string): Promise<Brief> {
  return api.getBrief(slug, adId);
}

export async function saveBrief(slug: string, adId: string, brief: Brief): Promise<void> {
  await api.putBrief(slug, adId, brief);
}
