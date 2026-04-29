import { render, screen } from '@testing-library/react';
import { DesktopChrome } from './DesktopChrome';
import { describe, it, expect } from 'vitest';

describe('DesktopChrome', () => {
  it('renders the children', () => {
    render(
      <DesktopChrome width={800} height={600}>
        <div>child content</div>
      </DesktopChrome>
    );
    expect(screen.getByText('child content')).toBeTruthy();
  });

  it('renders the title in the bar', () => {
    render(
      <DesktopChrome width={800} height={600} title="My Page">
        <div />
      </DesktopChrome>
    );
    expect(screen.getByText('My Page')).toBeTruthy();
  });

  it('does NOT render fake non-functional window controls', () => {
    // The Claude-AI-design boilerplate added 3 SVG icons (min/max/close) with
    // cursor: 'default' and no handlers — pure decoration. This is a web app,
    // not Electron; we can't minimize/maximize/close anything. Drop them.
    const { container } = render(
      <DesktopChrome width={800} height={600}>
        <div />
      </DesktopChrome>
    );
    // The previous implementation had exactly 3 svgs in the titlebar (the
    // controls) plus 0 elsewhere in the chrome. After cleanup the only svg
    // allowed in the titlebar is the dot logo (which is a div, not svg).
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });
});
