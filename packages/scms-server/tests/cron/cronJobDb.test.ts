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

const { dbCreateCronJob, dbUpdateCronJob, dbSeedBuiltinCronJob, dbSetCronJobEnabled } =
  await import('../../src/backend/cron/cronJobDb.server.js');

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

  it('derives HANDSHAKE target_scope from target_url at create time', async () => {
    await dbCreateCronJob('cron-1', {
      name: 'sweep',
      schedule: '* * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
    });

    expect(mockCronJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          target_auth: CronJobTargetAuth.HANDSHAKE,
          target_scope: 'POST:/v1/hooks/text-integrity/retry-sweep',
        }),
      }),
    );
  });

  it('rejects HANDSHAKE HTTP cron without target_url or target_scope at create time', async () => {
    await expect(
      dbCreateCronJob('cron-1', {
        name: 'missing-scope',
        schedule: '* * * * *',
        target_type: CronJobTargetType.HTTP,
        target_url: null,
        target_auth: CronJobTargetAuth.HANDSHAKE,
      }),
    ).rejects.toThrow(/HANDSHAKE cron missing target_scope/);

    expect(mockCronJobCreate).not.toHaveBeenCalled();
  });

  it('allows HTTP cron without target_url (scope-resolved at runtime)', async () => {
    await dbCreateCronJob('cron-1', {
      name: 'drain',
      schedule: '* * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: null,
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'POST:/v1/jobs/push-to-drain',
    });

    expect(mockCronJobCreate).toHaveBeenCalledOnce();
  });

  it('allows text-integrity retry sweep without target_url', async () => {
    await dbCreateCronJob('cron-2', {
      name: 'retry-sweep',
      schedule: '*/5 * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: null,
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'POST:/v1/hooks/text-integrity/retry-sweep',
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

  it('derives HANDSHAKE target_scope from target_url at update time', async () => {
    mockCronJobFindUnique.mockResolvedValue({
      id: 'cron-1',
      schedule: '* * * * *',
      timezone: 'UTC',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
      http_method: 'POST',
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'old-scope',
    });

    await dbUpdateCronJob('cron-1', { target_scope: null });

    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          target_scope: 'POST:/v1/hooks/text-integrity/retry-sweep',
        }),
      }),
    );
  });

  it('derives target_scope when updating an HTTP cron to HANDSHAKE auth', async () => {
    mockCronJobFindUnique.mockResolvedValue({
      id: 'cron-1',
      schedule: '* * * * *',
      timezone: 'UTC',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/jobs/push-to-drain',
      http_method: 'POST',
      target_auth: CronJobTargetAuth.NONE,
      target_scope: null,
    });

    await dbUpdateCronJob('cron-1', { target_auth: CronJobTargetAuth.HANDSHAKE });

    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          target_auth: CronJobTargetAuth.HANDSHAKE,
          target_scope: 'POST:/v1/jobs/push-to-drain',
        }),
      }),
    );
  });
});

describe('dbSeedBuiltinCronJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronJobCreate.mockResolvedValue({ id: 'builtin-1' });
  });

  it('is a no-op when a row with this id already exists', async () => {
    mockCronJobFindUnique.mockResolvedValue({ id: 'builtin-1' });

    await dbSeedBuiltinCronJob('builtin-1', {
      name: 'sweep',
      schedule: '* * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'text-integrity-retry-sweep',
    });

    expect(mockCronJobCreate).not.toHaveBeenCalled();
  });

  it('delegates to dbCreateCronJob (including target_url validation) when missing', async () => {
    mockCronJobFindUnique.mockResolvedValue(null);

    await expect(
      dbSeedBuiltinCronJob('builtin-1', {
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

  it('recomputes next_run_at when re-enabling a job cleared by invalid-schedule disable', async () => {
    mockCronJobFindUnique.mockResolvedValue({
      id: 'cron-1',
      schedule: '0 * * * *',
      timezone: 'UTC',
      enabled: false,
      next_run_at: null,
      target_type: CronJobTargetType.JOB,
      target_url: null,
      http_method: 'POST',
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: null,
    });

    await dbSetCronJobEnabled('cron-1', true);

    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: true,
          next_run_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      }),
    );
  });

  it('honors an explicit next_run_at override instead of computing one', async () => {
    mockCronJobFindUnique.mockResolvedValue(null);

    await dbSeedBuiltinCronJob('builtin-1', {
      name: 'sweep',
      schedule: '* * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: 'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: 'text-integrity-retry-sweep',
      next_run_at: '2026-01-01T00:00:00.000Z',
    });

    expect(mockCronJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ next_run_at: '2026-01-01T00:00:00.000Z' }),
      }),
    );
  });
});
