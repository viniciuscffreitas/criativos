import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, streamGenerate } from './api';
import type { StreamEvent } from './api';
import type { GenerateRequest } from './types';

const DUMMY_PAYLOAD: GenerateRequest = {
  project_slug: 'test',
  ad_id: 'ad-1',
  methodology: 'PAS',
  n_variants: 1,
  persist: false,
};

function makeStream(...chunks: string[]): typeof fetch {
  return async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const encoder = new TextEncoder();
    let chunkIndex = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(encoder.encode(chunks[chunkIndex++]));
        } else {
          controller.close();
        }
      },
    });
    return new Response(stream, { status: 200 }) as Response;
  };
}

function collect(fetchImpl: typeof fetch): Promise<StreamEvent[]> {
  return new Promise((resolve) => {
    const events: StreamEvent[] = [];
    streamGenerate(
      DUMMY_PAYLOAD,
      (e) => events.push(e),
      () => resolve(events),
      fetchImpl,
    );
  });
}

describe('streamGenerate SSE parser', () => {
  it('parses a well-formed single event', async () => {
    const fetchImpl = makeStream('event: run_start\ndata: {"run_id":"abc","pipeline_version":"1","started_at":"now"}\n\n');
    const events = await collect(fetchImpl);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('run_start');
    expect((events[0] as Extract<StreamEvent, { type: 'run_start' }>).payload.run_id).toBe('abc');
  });

  it('parses multiple events in one buffer', async () => {
    const fetchImpl = makeStream(
      'event: run_start\ndata: {"run_id":"r1","pipeline_version":"1","started_at":"now"}\n\n' +
      'event: run_start\ndata: {"run_id":"r2","pipeline_version":"1","started_at":"now"}\n\n',
    );
    const events = await collect(fetchImpl);
    expect(events).toHaveLength(2);
    expect((events[0] as Extract<StreamEvent, { type: 'run_start' }>).payload.run_id).toBe('r1');
    expect((events[1] as Extract<StreamEvent, { type: 'run_start' }>).payload.run_id).toBe('r2');
  });

  it('handles event split across reads', async () => {
    const fetchImpl = makeStream(
      'event: run_start\ndata: {"run_id":"abc","pipeline_version":"1",',
      '"started_at":"now"}\n\n',
    );
    const events = await collect(fetchImpl);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('run_start');
    expect((events[0] as Extract<StreamEvent, { type: 'run_start' }>).payload.run_id).toBe('abc');
  });

  it('emits error event on malformed JSON', async () => {
    const fetchImpl = makeStream('event: run_start\ndata: {bad json}\n\n');
    const events = await collect(fetchImpl);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    const err = events[0] as Extract<StreamEvent, { type: 'error' }>;
    expect(err.payload.code).toBe('SSE_PARSE_ERROR');
    expect(err.payload.error).toMatch(/malformed SSE frame/);
    expect(err.payload.raw).toBe('{bad json}');
  });
});

describe('render API client', () => {
  const okJson = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      okJson({ category: 'manifest', categories: { 'brand-logos': [], 'brand-social': [], 'brand-favicons': [], 'meta-ads': [], 'instagram': [] } }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('getRenderManifest hits GET /render/manifest', async () => {
    await api.getRenderManifest();
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/v1/render/manifest');
  });

  it('renderBrand POSTs /render/brand', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      okJson({ category: 'brand-pack', ok_count: 0, total: 0, results: [], started_at: '', finished_at: '', duration_ms: 0 }),
    );
    await api.renderBrand();
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/v1/render/brand');
    expect(call[1]?.method).toBe('POST');
  });

  it('renderAds passes ad_id query param', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      okJson({ category: 'meta-ads', ok_count: 0, total: 0, results: [], started_at: '', finished_at: '', duration_ms: 0 }),
    );
    await api.renderAds('01');
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/v1/render/ads?ad_id=01');
    expect(call[1]?.method).toBe('POST');
  });

  it('renderAds without ad_id renders all', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      okJson({ category: 'meta-ads', ok_count: 0, total: 0, results: [], started_at: '', finished_at: '', duration_ms: 0 }),
    );
    await api.renderAds();
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/v1/render/ads');
  });

  it('renderInstagram passes stem query param', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      okJson({ category: 'instagram', ok_count: 0, total: 0, results: [], started_at: '', finished_at: '', duration_ms: 0 }),
    );
    await api.renderInstagram('single-manifesto');
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/v1/render/instagram?stem=single-manifesto');
    expect(call[1]?.method).toBe('POST');
  });

  it('renderAll POSTs /render/all', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      okJson({ category: 'all', ok_count: 0, total: 0, results: [], started_at: '', finished_at: '', duration_ms: 0 }),
    );
    await api.renderAll();
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/v1/render/all');
    expect(call[1]?.method).toBe('POST');
  });

  it('throws structured error on non-2xx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unknown ad_id', code: 'NOT_FOUND' }), {
        status: 404, headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(api.renderAds('99')).rejects.toThrow(/NOT_FOUND/);
  });
});

