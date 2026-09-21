// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { configFromState, stateFromConfig } from './RedirectsField.js';

describe('redirects state', () => {
  it('nothing configured round-trips to undefined', () => {
    const state = stateFromConfig(undefined);
    expect(state.rules).toEqual([]);
    expect(state.groups.$landing.enabled).toBe(false);
    expect(configFromState(state)).toBeUndefined();
  });

  it('a bare-string group shows default status and query, and saves back as a string', () => {
    const state = stateFromConfig({ $landing: 'https://example.org/' });
    expect(state.groups.$landing).toEqual({
      enabled: true,
      to: 'https://example.org/',
      status: 302,
      forwardQuery: true,
    });
    expect(configFromState(state)).toEqual({ $landing: 'https://example.org/' });
  });

  it('a non-default status or query becomes a spec', () => {
    const state = stateFromConfig({ $info: { to: '/x/:slug', status: 301, forward_query: false } });
    expect(state.groups.$info).toMatchObject({ status: 301, forwardQuery: false });
    expect(configFromState(state)).toEqual({
      $info: { to: '/x/:slug', status: 301, forward_query: false },
    });
  });

  it('rules keep order and drop default fields on the way out', () => {
    const state = stateFromConfig({
      rules: [
        { from: '/a', to: '/b' },
        { from: '/docs/*', to: 'https://d.org/:splat', status: 301 },
      ],
    });
    expect(state.rules.map((r) => r.from)).toEqual(['/a', '/docs/*']);
    expect(state.rules.every((r) => typeof r.id === 'string')).toBe(true);
    expect(configFromState(state)).toEqual({
      rules: [
        { from: '/a', to: '/b' },
        { from: '/docs/*', to: 'https://d.org/:splat', status: 301 },
      ],
    });
  });

  it('a disabled group is dropped even if it still has text', () => {
    const state = stateFromConfig({ $notFound: '/' });
    state.groups.$notFound.enabled = false;
    expect(configFromState(state)).toBeUndefined();
  });
});
