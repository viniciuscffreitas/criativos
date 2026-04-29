import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Brief } from '../types';

// Stub the api module before importing the module under test
const mockGetBrief = vi.fn();
const mockPutBrief = vi.fn();

vi.mock('../api', () => ({
  api: {
    getBrief: mockGetBrief,
    putBrief: mockPutBrief,
  },
}));

// Import after vi.mock so the stub is in place
const { loadBrief, saveBrief } = await import('./brief');

const BRIEF: Brief = {
  product: 'Custom websites from €450',
  audience: 'European freelancers',
  pain: 'Losing clients to competitors with real sites',
  ctas: ['Message me'],
  social_proof: '6 sites built last month',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadBrief', () => {
  it('delegates to api.getBrief with correct args and returns the result', async () => {
    mockGetBrief.mockResolvedValueOnce(BRIEF);
    const result = await loadBrief('vibeweb', '01');
    expect(mockGetBrief).toHaveBeenCalledOnce();
    expect(mockGetBrief).toHaveBeenCalledWith('vibeweb', '01');
    expect(result).toEqual(BRIEF);
  });

  it('propagates api errors without swallowing them', async () => {
    mockGetBrief.mockRejectedValueOnce(new Error('NOT_FOUND: brief not found'));
    await expect(loadBrief('vibeweb', '99')).rejects.toThrow('NOT_FOUND: brief not found');
  });
});

describe('saveBrief', () => {
  it('delegates to api.putBrief with correct args', async () => {
    mockPutBrief.mockResolvedValueOnce({ updated: true, brief: BRIEF });
    await saveBrief('vibeweb', '01', BRIEF);
    expect(mockPutBrief).toHaveBeenCalledOnce();
    expect(mockPutBrief).toHaveBeenCalledWith('vibeweb', '01', BRIEF);
  });

  it('returns void (discards the PUT response body)', async () => {
    mockPutBrief.mockResolvedValueOnce({ updated: true, brief: BRIEF });
    const result = await saveBrief('vibeweb', '01', BRIEF);
    expect(result).toBeUndefined();
  });

  it('propagates api errors without swallowing them', async () => {
    mockPutBrief.mockRejectedValueOnce(new Error('HTTP_500: server error'));
    await expect(saveBrief('vibeweb', '01', BRIEF)).rejects.toThrow('HTTP_500: server error');
  });
});
