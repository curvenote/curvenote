// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ prisma: { doiRegistration: { findUnique: vi.fn() } } }));
vi.mock('@curvenote/scms-server', () => ({ getPrismaClient: async () => server.prisma }));

import { loadDoiRegistrationView } from './doiRegistration.server.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadDoiRegistrationView', () => {
  it('returns null when there is no registration row', async () => {
    server.prisma.doiRegistration.findUnique.mockResolvedValue(null);
    expect(await loadDoiRegistrationView('sub-1')).toBeNull();
  });

  it('reports SUBMITTING with no prior failed attempt as not retried', async () => {
    server.prisma.doiRegistration.findUnique.mockResolvedValue({
      status: 'SUBMITTING',
      doi: 'd',
      _count: { attempts: 0 },
    });
    expect(await loadDoiRegistrationView('sub-1')).toEqual({
      status: 'SUBMITTING',
      doi: 'd',
      retried: false,
    });
  });

  it('reports SUBMITTING after a failed attempt as retried', async () => {
    server.prisma.doiRegistration.findUnique.mockResolvedValue({
      status: 'SUBMITTING',
      doi: 'd',
      _count: { attempts: 1 },
    });
    expect(await loadDoiRegistrationView('sub-1')).toEqual({
      status: 'SUBMITTING',
      doi: 'd',
      retried: true,
    });
  });

  it('reports FAILED as not retried regardless of the failed-attempt count', async () => {
    server.prisma.doiRegistration.findUnique.mockResolvedValue({
      status: 'FAILED',
      doi: 'd',
      _count: { attempts: 3 },
    });
    expect(await loadDoiRegistrationView('sub-1')).toEqual({
      status: 'FAILED',
      doi: 'd',
      retried: false,
    });
  });

  it('treats a legacy DRAFT row as no registration', async () => {
    server.prisma.doiRegistration.findUnique.mockResolvedValue({
      status: 'DRAFT',
      doi: 'd',
      _count: { attempts: 0 },
    });
    expect(await loadDoiRegistrationView('sub-1')).toBeNull();
  });

  it('queries by submission_id, selecting status, doi and the failed-attempt count', async () => {
    server.prisma.doiRegistration.findUnique.mockResolvedValue(null);
    await loadDoiRegistrationView('sub-1');
    expect(server.prisma.doiRegistration.findUnique).toHaveBeenCalledWith({
      where: { submission_id: 'sub-1' },
      select: {
        status: true,
        doi: true,
        _count: { select: { attempts: { where: { status: 'FAILED' } } } },
      },
    });
  });
});
