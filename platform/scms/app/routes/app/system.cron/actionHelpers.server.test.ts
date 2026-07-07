/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CronJobTargetAuth,
  CronJobTargetType,
  dbCreateCronJob,
  getConfig,
  validateFormData,
  type SecureContext,
} from '@curvenote/scms-server';
import { CronEndpointScopes, cronEndpointScope } from '@curvenote/scms-core';
import { CreateCronJobSchema, handleCreateCronJob } from './actionHelpers.server.js';

const API_URL = 'http://localhost:3031/v1';
const CRON_ID = '01900000-0000-7000-8000-000000000001';

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    dbCreateCronJob: vi.fn(),
    getConfig: vi.fn(),
    uuidv7: vi.fn(() => CRON_ID),
  };
});

vi.mock('uuidv7', () => ({
  uuidv7: vi.fn(() => CRON_ID),
}));

const ctx = { user: { id: 'user-1' } } as SecureContext;

function createFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set('intent', 'create');
  formData.set('name', 'Test Cron');
  formData.set('schedule', '0 * * * *');
  formData.set('http_method', 'POST');
  formData.set('target_path', '/v1/loopback');
  formData.set('target_scope', CronEndpointScopes.LOOPBACK);

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

function expectValidationError(formData: FormData, field: string) {
  try {
    validateFormData(CreateCronJobSchema, formData);
    expect.fail('expected validation to fail');
  } catch (error) {
    const issues = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues;
    expect(issues?.some((issue) => issue.path.includes(field))).toBe(true);
  }
}

describe('CreateCronJobSchema', () => {
  it('accepts a valid relative target_path and scope', () => {
    const payload = validateFormData(CreateCronJobSchema, createFormData());
    expect(payload.target_path).toBe('/v1/loopback');
    expect(payload.target_scope).toBe(CronEndpointScopes.LOOPBACK);
  });

  it.each(['/v1/loopback', '/v1/jobs/push-to-drain', '/v1/cron/tick'])(
    'accepts target_path %s',
    (targetPath) => {
      const payload = validateFormData(
        CreateCronJobSchema,
        createFormData({ target_path: targetPath }),
      );
      expect(payload.target_path).toBe(targetPath);
    },
  );

  it.each([
    ['v1/loopback', 'missing leading slash'],
    ['', 'empty path'],
    ['http://evil.example/v1/hooks', 'absolute URL'],
    ['/v1/path with space', 'embedded whitespace'],
  ])('rejects target_path %s (%s)', (targetPath) => {
    expectValidationError(createFormData({ target_path: targetPath }), 'target_path');
  });

  it('requires target_scope', () => {
    expectValidationError(createFormData({ target_scope: '' }), 'target_scope');
  });

  it('rejects invalid http_method values', () => {
    expectValidationError(createFormData({ http_method: 'TRACE' }), 'http_method');
  });
});

describe('handleCreateCronJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue({
      api: { url: API_URL },
    } as Awaited<ReturnType<typeof getConfig>>);
    vi.mocked(dbCreateCronJob).mockResolvedValue({} as Awaited<ReturnType<typeof dbCreateCronJob>>);
  });

  it('creates a cron job with resolved target_url and submitted scope', async () => {
    const targetPath = '/v1/loopback';
    const targetScope = cronEndpointScope('POST', targetPath);

    const result = await handleCreateCronJob(
      ctx,
      createFormData({ target_path: targetPath, target_scope: targetScope }),
    );

    expect(result).toEqual({
      success: true,
      message: 'Cron job created successfully',
    });
    expect(dbCreateCronJob).toHaveBeenCalledWith(CRON_ID, {
      name: 'Test Cron',
      description: null,
      schedule: '0 * * * *',
      target_type: CronJobTargetType.HTTP,
      target_url: `${API_URL.replace(/\/v1$/, '')}${targetPath}`,
      http_method: 'POST',
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: targetScope,
      created_by: 'user-1',
    });
  });

  it('passes through a manually overridden scope without re-deriving it', async () => {
    const manualScope = 'POST:/v1/custom-endpoint';

    const result = await handleCreateCronJob(
      ctx,
      createFormData({
        target_path: '/v1/loopback',
        target_scope: manualScope,
      }),
    );

    expect(result).toEqual({
      success: true,
      message: 'Cron job created successfully',
    });
    expect(dbCreateCronJob).toHaveBeenCalledWith(
      CRON_ID,
      expect.objectContaining({
        target_scope: manualScope,
      }),
    );
  });

  it('returns a validation error for invalid target_path', async () => {
    const result = await handleCreateCronJob(ctx, createFormData({ target_path: 'not-a-path' }));

    expect(result).toMatchObject({
      data: {
        error: {
          message: expect.stringContaining('[target_path]'),
        },
      },
    });
    expect(dbCreateCronJob).not.toHaveBeenCalled();
  });

  it('returns a validation error when target_scope is missing', async () => {
    const result = await handleCreateCronJob(ctx, createFormData({ target_scope: '' }));

    expect(result).toMatchObject({
      data: {
        error: {
          message: expect.stringContaining('[target_scope]'),
        },
      },
    });
    expect(dbCreateCronJob).not.toHaveBeenCalled();
  });

  it('returns a validation error for an invalid cron schedule', async () => {
    const result = await handleCreateCronJob(ctx, createFormData({ schedule: 'not-a-cron' }));

    expect(result).toMatchObject({
      data: {
        error: {
          message: 'Invalid cron schedule expression',
        },
      },
    });
    expect(dbCreateCronJob).not.toHaveBeenCalled();
  });
});
