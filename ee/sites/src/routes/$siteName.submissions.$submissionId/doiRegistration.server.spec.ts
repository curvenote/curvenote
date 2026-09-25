// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ prisma: { doiRegistration: { findFirst: vi.fn() } } }));
vi.mock('@curvenote/scms-server', () => ({ getPrismaClient: async () => server.prisma }));

import { doiRowState, loadDoiRegistrationView } from './doiRegistration.server.js';
import type { DoiRegistrationView } from './types.js';

type Attempt = { status: string; error: string | null; warning: string | null };

function registration(status: string, attempts: Attempt[], failedAttempts = 0) {
  return { status, doi: 'd', attempts, _count: { attempts: failedAttempts } };
}

const attempt = (status: string, extra: Partial<Attempt> = {}): Attempt => ({
  status,
  error: null,
  warning: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadDoiRegistrationView', () => {
  it('looks the registration up within the site', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(null);
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toBeNull();
    expect(server.prisma.doiRegistration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { submission_id: 'sub-1', site_id: 'site-a' } }),
    );
  });

  it('is sending while the latest attempt is PENDING', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(
      registration('SUBMITTING', [attempt('PENDING')]),
    );
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toEqual({
      status: 'SUBMITTING',
      doi: 'd',
      phase: 'sending',
      retried: false,
    });
  });

  it('is waiting for Crossref once the latest attempt is QUEUED', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(
      registration('SUBMITTING', [attempt('QUEUED')]),
    );
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toMatchObject({ phase: 'waiting' });
  });

  it('uses the latest attempt and marks a retry after a failed one', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(
      registration('SUBMITTING', [attempt('PENDING')], 1),
    );
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toEqual({
      status: 'SUBMITTING',
      doi: 'd',
      phase: 'sending',
      retried: true,
    });
    expect(server.prisma.doiRegistration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          attempts: expect.objectContaining({ orderBy: { date_created: 'desc' }, take: 1 }),
        }),
      }),
    );
  });

  it('describes why a registration failed, from its latest attempt', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(
      registration('FAILED', [attempt('FAILED', { error: 'no_result_after_horizon' })], 1),
    );
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toEqual({
      status: 'FAILED',
      doi: 'd',
      reason: {
        summary:
          "Crossref didn't confirm the registration within 72 hours. Retry to submit it again.",
      },
    });
  });

  it('carries Crossref warning on a registered DOI', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(
      registration('REGISTERED', [attempt('SUCCEEDED', { warning: 'Added with conflict' })]),
    );
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toEqual({
      status: 'REGISTERED',
      doi: 'd',
      warning: 'Added with conflict',
    });
  });

  it('has no warning on a clean registration', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(
      registration('REGISTERED', [attempt('SUCCEEDED')]),
    );
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toEqual({
      status: 'REGISTERED',
      doi: 'd',
    });
  });

  it('treats a legacy DRAFT row as no registration', async () => {
    server.prisma.doiRegistration.findFirst.mockResolvedValue(registration('DRAFT', []));
    expect(await loadDoiRegistrationView('site-a', 'sub-1')).toBeNull();
  });
});

describe('doiRowState', () => {
  const workDoi = '10.5555/abc';
  const failed: DoiRegistrationView = { status: 'FAILED', doi: 'd', reason: { summary: 'x' } };
  const registered: DoiRegistrationView = { status: 'REGISTERED', doi: 'd', warning: 'w' };
  const startReadiness = vi.fn(() => Promise.resolve({ ready: true } as never));

  it('shows the registration, even when a DOI resolves, so a warning is not lost', () => {
    expect(doiRowState({ doi: 'd', registration: registered, startReadiness })).toEqual({
      kind: 'registration',
      registration: registered,
    });
    expect(startReadiness).not.toHaveBeenCalled();
  });

  it("shows the work's own DOI instead of a failed registration, whose Retry would be refused", () => {
    expect(doiRowState({ doi: workDoi, registration: failed, startReadiness })).toEqual({
      kind: 'doi',
      doi: workDoi,
    });
  });

  it('shows a failed registration when no DOI resolves', () => {
    expect(doiRowState({ doi: undefined, registration: failed, startReadiness })).toEqual({
      kind: 'registration',
      registration: failed,
    });
  });

  it('shows the DOI without starting the readiness check', () => {
    expect(doiRowState({ doi: workDoi, registration: null, startReadiness })).toEqual({
      kind: 'doi',
      doi: workDoi,
    });
    expect(startReadiness).not.toHaveBeenCalled();
  });

  it('offers Register, with the readiness check started, when there is nothing to show yet', () => {
    const state = doiRowState({ doi: undefined, registration: null, startReadiness });
    expect(state.kind).toBe('register');
    expect(startReadiness).toHaveBeenCalledTimes(1);
  });

  it('shows nothing to a viewer who cannot see DOI registration', () => {
    expect(doiRowState({ doi: undefined, registration: null, startReadiness: null })).toEqual({
      kind: 'none',
    });
  });
});
