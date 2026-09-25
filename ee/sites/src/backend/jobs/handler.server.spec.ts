// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';

vi.mock('@curvenote/scms-server', () => ({ dbUpdateJob: vi.fn() }));

import { parsePayload } from './handler.server.js';

describe('parsePayload', () => {
  it('reads depositId, siteId and attempt', () => {
    expect(parsePayload({ depositId: 'dep-1', siteId: 'site-a', attempt: 3 })).toEqual({
      depositId: 'dep-1',
      siteId: 'site-a',
      attempt: 3,
    });
  });

  it('defaults attempt to 1', () => {
    expect(parsePayload({ depositId: 'dep-1', siteId: 'site-a' }).attempt).toBe(1);
  });

  it('rejects a payload without depositId or siteId', () => {
    expect(() => parsePayload({ siteId: 'site-a' })).toThrow();
    expect(() => parsePayload({ depositId: 'dep-1' })).toThrow();
    expect(() => parsePayload(null)).toThrow();
  });

  it('rejects an attempt below 1', () => {
    expect(() => parsePayload({ depositId: 'dep-1', siteId: 'site-a', attempt: 0 })).toThrow();
  });
});
