import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StudioStream } from './StudioStream';
import type { StudioStreamEvent } from '../types';

const ev = (xs: Array<[string, any]>): StudioStreamEvent[] =>
  xs.map(([type, payload]) => ({ type, payload }) as StudioStreamEvent);

describe('StudioStream', () => {
  it('renders three node labels (planning / copy / render)', () => {
    render(<StudioStream events={[]}/>);
    expect(screen.getByText(/Entendendo/i)).toBeInTheDocument();
    expect(screen.getByText(/Gerando copy/i)).toBeInTheDocument();
    expect(screen.getByText(/Renderizando/i)).toBeInTheDocument();
  });

  it('lights up planning node when its node_start fires', () => {
    const events = ev([
      ['run_start', { run_id: 'r1', pipeline_version: 'v', started_at: 's' }],
      ['node_start', { node_id: 'planning', label: 'Entendendo seu pedido', start_ms: 0 }],
    ]);
    render(<StudioStream events={events}/>);
    expect(screen.getByTestId('node-planning')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('node-copy')).toHaveAttribute('data-state', 'idle');
  });

  it('marks node done when node_done fires', () => {
    const events = ev([
      ['node_start', { node_id: 'planning', label: 'l', start_ms: 0 }],
      ['node_done', { node_id: 'planning', end_ms: 10, tokens: 0, confidence: null, output_preview: '' }],
    ]);
    render(<StudioStream events={events}/>);
    expect(screen.getByTestId('node-planning')).toHaveAttribute('data-state', 'done');
  });

  it('shows plan summary card after plan_decided', () => {
    const events = ev([
      ['plan_decided', {
        plan: {
          category: 'meta-ads',
          template_id: '01-portfolio-grid',
          methodology: 'pas',
          n_variants: 3,
          reasoning: 'because of social proof',
          brief: { product: 'p', audience: 'a', pain: 'x', ctas: ['go'], social_proof: null },
        },
      }],
    ]);
    render(<StudioStream events={events}/>);
    expect(screen.getByText(/01-portfolio-grid/)).toBeInTheDocument();
    expect(screen.getByText(/meta-ads/i)).toBeInTheDocument();
    expect(screen.getByText(/social proof/i)).toBeInTheDocument();
  });

  it('lists render_progress events with status pill', () => {
    const events = ev([
      ['render_progress', { file: 'a.png', status: 'rendering', url: null }],
      ['render_progress', { file: 'a.png', status: 'ok', url: '/r/a.png' }],
    ]);
    render(<StudioStream events={events}/>);
    expect(screen.getByText('a.png')).toBeInTheDocument();
    // The "ok" status replaces the "rendering" status for the same file
    expect(screen.getByText(/^ok$/i)).toBeInTheDocument();
  });

  it('renders a §2.7 alert when error event is received', () => {
    const events = ev([
      ['error', { code: 'PLANNER_FAILED', error: 'planner exploded' }],
    ]);
    render(<StudioStream events={events}/>);
    expect(screen.getByRole('alert')).toHaveTextContent(/planner exploded/);
  });

  it('shows token preview for the copy node', () => {
    const events = ev([
      ['token', { node_id: 'copy', variant_id: 'V1', text: 'Hello ' }],
      ['token', { node_id: 'copy', variant_id: 'V1', text: 'world!' }],
    ]);
    render(<StudioStream events={events}/>);
    expect(screen.getByText(/Hello world!/)).toBeInTheDocument();
  });
});
