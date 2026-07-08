// @vitest-environment jsdom
/* eslint-disable import/no-extraneous-dependencies */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from './useDelayedFlag';

function DelayedFlagProbe({ active, delayMs }: { active: boolean; delayMs: number }) {
  const value = useDelayedFlag(active, delayMs);
  return createElement('span', { 'data-testid': 'flag', 'data-value': String(value) });
}

describe('useDelayedFlag', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function renderProbe(active: boolean, delayMs: number) {
    act(() => {
      root.render(createElement(DelayedFlagProbe, { active, delayMs }));
    });
  }

  function readFlag(): boolean {
    return container.querySelector('[data-testid="flag"]')?.getAttribute('data-value') === 'true';
  }

  it('stays false until active has been true continuously for delayMs', () => {
    renderProbe(true, 1000);
    expect(readFlag()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(readFlag()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(readFlag()).toBe(true);
  });

  it('resets immediately when active becomes false', () => {
    renderProbe(true, 500);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(readFlag()).toBe(true);

    renderProbe(false, 500);
    expect(readFlag()).toBe(false);
  });

  it('restarts the countdown when active toggles off before the delay elapses', () => {
    renderProbe(true, 1000);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(readFlag()).toBe(false);

    renderProbe(false, 1000);
    expect(readFlag()).toBe(false);

    renderProbe(true, 1000);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(readFlag()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(readFlag()).toBe(true);
  });
});
