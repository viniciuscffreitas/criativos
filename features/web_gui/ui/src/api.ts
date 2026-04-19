import type { Project, Creative, Brief, AgentResult, GenerateRequest, CopyVariant } from './types';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { 'content-type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: r.statusText, code: `HTTP_${r.status}` }));
    throw new Error(`${body.code || 'ERROR'}: ${body.error || r.statusText}`);
  }
  return r.json();
}

export const api = {
  listProjects: () => req<{ projects: Project[] }>('/projects'),
  listCreatives: (slug: string, kind?: string) =>
    req<{ creatives: Creative[] }>(`/projects/${slug}/creatives${kind ? `?kind=${kind}` : ''}`),
  getBrief: (slug: string, adId: string) =>
    req<Brief>(`/projects/${slug}/ads/${adId}/brief`),
  putBrief: (slug: string, adId: string, brief: Brief) =>
    req<{ updated: boolean; brief: Brief }>(`/projects/${slug}/ads/${adId}/brief`, {
      method: 'PUT', body: JSON.stringify(brief),
    }),
  patchVariant: (
    runId: string,
    variantId: string,
    patch: Partial<Pick<CopyVariant, 'selected' | 'headline' | 'primary_text' | 'description' | 'ctas'>>,
  ) => req(`/variants/${runId}/${variantId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  getTrace: (runId: string) => req<AgentResult>(`/traces/${runId}`),
  uploadAssets: async (slug: string, files: File[]) => {
    const fd = new FormData();
    fd.append('project_slug', slug);
    for (const f of files) fd.append('files', f);
    const r = await fetch(`${BASE}/assets/upload`, { method: 'POST', body: fd });
    if (!r.ok) {
      const body = await r.json().catch(() => ({ error: r.statusText, code: `HTTP_${r.status}` }));
      throw new Error(`${body.code || 'ERROR'}: ${body.error || r.statusText}`);
    }
    return r.json();
  },
};

export type StreamEvent =
  | { type: 'run_start'; payload: { run_id: string; pipeline_version: string; started_at: string } }
  | { type: 'node_start'; payload: { node_id: string; label: string; start_ms: number } }
  | { type: 'node_done'; payload: { node_id: string; end_ms: number; tokens: number; confidence: number | null; output_preview: string } }
  | { type: 'token'; payload: { node_id: string; variant_id: string; text: string } }
  | { type: 'variant_done'; payload: CopyVariant }
  | { type: 'done'; payload: AgentResult }
  | { type: 'error'; payload: { error: string; code: string; raw?: string } };

export function streamGenerate(
  payload: GenerateRequest,
  onEvent: (e: StreamEvent) => void,
  onComplete?: () => void,
  fetchImpl: typeof fetch = fetch,
): () => void {
  const controller = new AbortController();
  (async () => {
    const r = await fetchImpl(`${BASE}/generate/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!r.body) {
      onEvent({ type: 'error', payload: { error: 'SSE response has no body', code: 'NO_BODY' } });
      onComplete?.();
      return;
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = block.split('\n');
        let eventName = '';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (eventName && dataStr) {
          try {
            onEvent({ type: eventName as StreamEvent['type'], payload: JSON.parse(dataStr) });
          } catch (err) {
            onEvent({
              type: 'error',
              payload: {
                error: `malformed SSE frame: ${(err as Error).message}`,
                code: 'SSE_PARSE_ERROR',
                raw: dataStr.slice(0, 200),
              },
            });
          }
        }
      }
    }
    onComplete?.();
  })();
  return () => controller.abort();
}
