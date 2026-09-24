// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  usePolling: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@curvenote/scms-core', () => ({ usePolling: mocks.usePolling }));
vi.mock('react-router', () => ({
  useRevalidator: () => ({ revalidate: mocks.revalidate, state: 'idle' }),
}));

import { doiRowRefreshKey, useDoiRowRefresh } from './doiRowRefresh.js';

const doi = 'd';

describe('doiRowRefreshKey', () => {
  it('has a key only while the registration is in progress, one per phase', () => {
    expect(doiRowRefreshKey({ status: 'SUBMITTING', doi, phase: 'sending', retried: false })).toBe(
      'SUBMITTING:sending',
    );
    expect(doiRowRefreshKey({ status: 'SUBMITTING', doi, phase: 'waiting', retried: true })).toBe(
      'SUBMITTING:waiting',
    );
  });

  it('never polls for a settled registration or none at all', () => {
    expect(doiRowRefreshKey({ status: 'REGISTERED', doi })).toBeNull();
    expect(doiRowRefreshKey({ status: 'FAILED', doi, reason: { summary: 'x' } })).toBeNull();
    expect(doiRowRefreshKey(null)).toBeNull();
  });
});

type HarnessProps = { refreshKey: string | null };

function Harness({ refreshKey }: HarnessProps) {
  useDoiRowRefresh('/status', refreshKey);
  return null;
}

function renderHook(refreshKey: string | null) {
  mocks.usePolling.mockClear();
  renderToStaticMarkup(createElement(Harness, { refreshKey }));
  return mocks.usePolling.mock.calls[0][0];
}

describe('useDoiRowRefresh', () => {
  beforeEach(() => {
    mocks.usePolling.mockClear();
    mocks.revalidate.mockClear();
  });

  it('is disabled without a key and enabled once a key is set', () => {
    expect(renderHook(null).enabled).toBe(false);
    expect(renderHook('SUBMITTING:waiting').enabled).toBe(true);
  });

  it('rides out a bounded run of failed status checks instead of freezing on the first one', () => {
    const { numRetries } = renderHook('SUBMITTING:waiting');
    expect(numRetries).toBe(30);
  });

  it('stops only once the server reports a different key', () => {
    const { shouldStop } = renderHook('SUBMITTING:waiting');
    expect(shouldStop({ key: 'SUBMITTING:waiting' })).toBe(false);
    expect(shouldStop({ key: 'SUBMITTING:sending' })).toBe(true);
  });

  it('revalidates the page once the key changes', () => {
    const { onComplete } = renderHook('SUBMITTING:waiting');
    onComplete({ key: null });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });
});
