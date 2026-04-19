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
