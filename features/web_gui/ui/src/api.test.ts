import { describe, it, expect } from 'vitest';
import { streamGenerate } from './api';
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

