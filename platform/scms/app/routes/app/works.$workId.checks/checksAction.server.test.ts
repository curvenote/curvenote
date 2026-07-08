/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCheckDispatchIntent, handleChecksRouteAction } from './checksAction.server';

vi.mock('@curvenote/scms-server', () => ({
  userHasScope: vi.fn(() => true),
  userHasWorkScope: vi.fn(() => false),
}));

vi.mock('@curvenote/scms-core', async () => {
  const actual = await vi.importActual<typeof import('@curvenote/scms-core')>('@curvenote/scms-core');
  return {
    ...actual,
    getExtensionCheckServicesFromServerConfig: vi.fn(() => [
      {
        id: 'text-integrity',
        handleAction: vi.fn(),
      },
    ]),
    loadCheckMaintenanceByServiceId: vi.fn(async () => undefined),
  };
});

describe('isCheckDispatchIntent', () => {
  it('treats execute and retry intents as dispatch', () => {
    expect(isCheckDispatchIntent('execute')).toBe(true);
    expect(isCheckDispatchIntent('retry')).toBe(true);
    expect(isCheckDispatchIntent('retry-run')).toBe(true);
  });

  it('does not treat hydrate intents as dispatch', () => {
    expect(isCheckDispatchIntent('hydrate')).toBe(false);
    expect(isCheckDispatchIntent('refresh-status')).toBe(false);
  });
});

describe('handleChecksRouteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects dispatch intents without work dispatch scope', async () => {
    const formData = new FormData();
    formData.set('intent', 'execute');
    formData.set('workVersionId', 'wv-1');
    formData.set('checkServiceId', 'text-integrity');

    const response = await handleChecksRouteAction({
      ctx: {
        user: { id: 'user-1' },
        work: { id: 'work-1' },
        $config: {},
      } as never,
      formData,
      serverExtensions: [],
    });

    expect(response).toMatchObject({
      init: { status: 403 },
      data: {
        error: {
          message: 'You do not have permission to dispatch checks for this work',
        },
      },
    });
  });
});
