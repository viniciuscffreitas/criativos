import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import { App } from './App';

describe('App — §2.7 error surface', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Keep FlowView in loading state so loadBrief never resolves/rejects,
    // preventing a second role="alert" from interfering with App-level tests.
    vi.spyOn(api, 'getBrief').mockReturnValue(new Promise(() => {}));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a visible alert when listProjects rejects', async () => {
    vi.spyOn(api, 'listProjects').mockRejectedValueOnce(
      new Error('HTTP_500: boom'),
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao carregar projetos/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/HTTP_500: boom/);
    });
  });

  it('does not render the alert on success', async () => {
    vi.spyOn(api, 'listProjects').mockResolvedValueOnce({ projects: [] });
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('App — ad picker', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // FlowView's brief load stays pending so the picker chrome is the only
    // visible content while we assert against it.
    vi.spyOn(api, 'getBrief').mockReturnValue(new Promise(() => {}));
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an ad <select> with one option per ad in the active project', async () => {
    vi.spyOn(api, 'listProjects').mockResolvedValueOnce({
      projects: [{
        slug: 'vibeweb', name: 'Vibe Web', description: '',
        ad_count: 6, variant_count: 0, created_at: '',
      }],
    });
    render(<App />);
    await waitFor(() => {
      const select = screen.getByLabelText(/Ad ativo/i) as HTMLSelectElement;
      expect(select).toBeTruthy();
      // 6 options, ids "01".."06"
      expect(select.options.length).toBe(6);
      expect(select.options[0].value).toBe('01');
      expect(select.options[5].value).toBe('06');
    });
  });

  it('persists the selected adId to localStorage', async () => {
    vi.spyOn(api, 'listProjects').mockResolvedValueOnce({
      projects: [{
        slug: 'vibeweb', name: 'Vibe Web', description: '',
        ad_count: 6, variant_count: 0, created_at: '',
      }],
    });
    const { rerender } = render(<App />);
    const select = await screen.findByLabelText(/Ad ativo/i) as HTMLSelectElement;
    select.value = '03';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => {
      expect(localStorage.getItem('cr_ad_id')).toBe('03');
    });
    // Re-render — should restore from localStorage
    vi.spyOn(api, 'listProjects').mockResolvedValueOnce({
      projects: [{
        slug: 'vibeweb', name: 'Vibe Web', description: '',
        ad_count: 6, variant_count: 0, created_at: '',
      }],
    });
    rerender(<App />);
    await waitFor(() => {
      const select2 = screen.getByLabelText(/Ad ativo/i) as HTMLSelectElement;
      expect(select2.value).toBe('03');
    });
  });
});
