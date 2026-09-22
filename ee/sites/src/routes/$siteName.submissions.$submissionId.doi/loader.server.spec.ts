// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ prisma: { submission: { findFirst: vi.fn() } } }));
vi.mock('@curvenote/scms-server', () => ({ getPrismaClient: async () => server.prisma }));
const deposit = vi.hoisted(() => ({ assembleDeposit: vi.fn() }));
vi.mock('../../backend/deposit/assemble.server.js', () => deposit);

import { loadSubmissionDoiPage } from './loader.server.js';

const crossref = {
  host: 'https://test.crossref.org',
  depositorEmail: 'doi@curvenote.com',
  password: 'secret',
  prefix: '10.62329',
  role: 'curv',
};

function ctxWith(crossrefConfig: object | undefined) {
  return {
    site: { id: 'site-a', name: 'lapalma', title: 'La Palma' },
    $config: { api: { crossref: crossrefConfig } },
  } as any;
}

function row(overrides: Partial<{ versions: unknown[]; doiConfig: unknown }> = {}) {
  return {
    id: 'sub-1',
    versions: overrides.versions ?? [
      { id: 'sv-2', status: 'PENDING', work_version: { title: 'Draft title' } },
      { id: 'sv-1', status: 'PUBLISHED', work_version: { title: 'Published title' } },
    ],
    site: { doiConfig: 'doiConfig' in overrides ? overrides.doiConfig : { prefix: '10.99999' } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deposit.assembleDeposit.mockResolvedValue({ issues: [], doi: 'ignored', xml: '<x/>' });
});

describe('loadSubmissionDoiPage', () => {
  it('returns null for a submission that is not on this site', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(null);
    expect(await loadSubmissionDoiPage(ctxWith(crossref), 'sub-1')).toBeNull();
    expect(server.prisma.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1', site_id: 'site-a' } }),
    );
  });

  it('reports not_configured without assembling when api.crossref is missing', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(row());
    const page = await loadSubmissionDoiPage(ctxWith(undefined), 'sub-1');
    expect(page?.state).toEqual({ kind: 'not_configured' });
    expect(page?.submission).toEqual({ id: 'sub-1', title: 'Draft title' });
    expect(deposit.assembleDeposit).not.toHaveBeenCalled();
  });

  it('reports not_published without assembling when no version is PUBLISHED', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(
      row({ versions: [{ id: 'sv-2', status: 'PENDING', work_version: { title: 'Draft' } }] }),
    );
    const page = await loadSubmissionDoiPage(ctxWith(crossref), 'sub-1');
    expect(page?.state).toEqual({ kind: 'not_published' });
    expect(deposit.assembleDeposit).not.toHaveBeenCalled();
  });

  it('assembles the latest published version with a preview DOI under the site prefix', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(row());
    const page = await loadSubmissionDoiPage(ctxWith(crossref), 'sub-1');
    expect(page?.site).toEqual({ name: 'lapalma', title: 'La Palma' });
    expect(page?.submission).toEqual({ id: 'sub-1', title: 'Draft title' });
    expect(deposit.assembleDeposit).toHaveBeenCalledTimes(1);
    const [, versionId, opts] = deposit.assembleDeposit.mock.calls[0];
    expect(versionId).toBe('sv-1');
    expect(opts.doi).toMatch(/^10\.99999\/[a-z0-9]+$/);
    expect(opts.depositorEmail).toBe('doi@curvenote.com');
    expect(page?.state).toEqual({ kind: 'assembled', doi: opts.doi, issues: [], xml: '<x/>' });
  });

  it('falls back to the deployment prefix when the site has no DOI config', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(row({ doiConfig: null }));
    await loadSubmissionDoiPage(ctxWith(crossref), 'sub-1');
    const [, , opts] = deposit.assembleDeposit.mock.calls[0];
    expect(opts.doi).toMatch(/^10\.62329\//);
  });

  it('generates a fresh DOI and batch id on every load and persists nothing', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(row());
    await loadSubmissionDoiPage(ctxWith(crossref), 'sub-1');
    await loadSubmissionDoiPage(ctxWith(crossref), 'sub-1');
    const [, , first] = deposit.assembleDeposit.mock.calls[0];
    const [, , second] = deposit.assembleDeposit.mock.calls[1];
    expect(first.doi).not.toBe(second.doi);
    expect(first.batchId).not.toBe(second.batchId);
    expect(server.prisma.submission.findFirst).toHaveBeenCalledTimes(2);
  });
});
