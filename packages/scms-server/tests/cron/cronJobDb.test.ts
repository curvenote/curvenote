/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronJobTargetAuth, CronJobTargetType } from '@curvenote/scms-db';

const mockCronJobCreate = vi.fn();
const mockCronJobFindUnique = vi.fn();
const mockCronJobUpdate = vi.fn();

vi.mock('../../src/app-config.server.js', () => ({
  getConfig: vi.fn(async () => ({
    api: {
      url: 'http://localhost:3031/v1',
      tasksCallbackUrl: 'http://host.docker.internal:3031/v1',
    },
  })),
}));

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    cronJob: {
      create: mockCronJobCreate,
      findUnique: mockCronJobFindUnique,
      update: mockCronJobUpdate,
    },
  })),
}));

const { dbCreateCronJob, dbUpdateCronJob } = await import('../../src/backend/cron/cronJobDb.server.js');

describe('cronJobDb target_url validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronJobCreate.mockResolvedValue({ id: 'cron-1' });
    mockCronJobUpdate.mockResolvedValue({ id: 'cron-1' });
  });

  it('rejects disallowed target_url at create time', async () => {
    await expect(
      dbCreateCronJob('cron-1', {
        name: 'bad-host',
        schedule: '* * * * *',
        target_type: CronJobTargetType.HTTP,
        target_url: 'https://evil.example/v1/hooks/sweep',
        target_auth: CronJobTargetAuth.HANDSHAKE,
        target_scope: 'text-integrity-retry-sweep',
      }),
    ).rejects.toThrow(/host must match our own API host/);

    expect(mockCronJobCreate).not.toHaveBeenCalled();
  });

  it('accepts allowed target_url at create time', async () => {
    await dbCreateCronJob('cron-1', {
      name: 'sweep',
      schedule: '* * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'text-integrity-retry-sweep',
    });

    expect(mockCronJobCreate).toHaveBeenCalledOnce();
  });

  it('allows HTTP cron without target_url (scope-resolved at runtime)', async () => {
    await dbCreateCronJob('cron-1', {
      name: 'drain',
      schedule: '* * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: null,
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'job-queue-drain',
    });

    expect(mockCronJobCreate).toHaveBeenCalledOnce();
  });

  it('rejects disallowed target_url at update time', async () => {
    mockCronJobFindUnique.mockResolvedValue({
      id: 'cron-1',
      schedule: '* * * * *',
      timezone: 'UTC',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
    });

    await expect(
      dbUpdateCronJob('cron-1', {
        target_url: 'https://evil.example/v1/hooks/sweep',
      }),
    ).rejects.toThrow(/host must match our own API host/);

    expect(mockCronJobUpdate).not.toHaveBeenCalled();
  });
});
