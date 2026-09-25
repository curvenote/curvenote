// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ prisma: { submission: { findFirst: vi.fn() } } }));
vi.mock('@curvenote/scms-server', () => ({ getPrismaClient: async () => server.prisma }));
const deposit = vi.hoisted(() => ({ assembleDeposit: vi.fn() }));
vi.mock('./assemble.server.js', () => deposit);

import { loadDoiReadiness } from './readiness.server.js';
import type { DepositIssue, DepositSummary } from './types.js';

const crossref = {
  host: 'https://crossref.example.com',
  depositorEmail: 'doi@curvenote.com',
  password: 'secret',
  prefix: '10.62329',
  role: 'curv',
  resourceUrlBase: 'https://doi.example.com',
};

const summary: DepositSummary = {
  title: 'Published title',
  date: '2022-10-11T00:00:00.000Z',
  authors: [{ name: 'Steve Purves' }],
  hasAbstract: true,
  citationCount: 0,
};
const warn: DepositIssue = { severity: 'warning', code: 'missing_license', message: 'w' };
const block: DepositIssue = { severity: 'blocking', code: 'missing_title', message: 'b' };

function ctxWith(crossrefConfig: object | undefined) {
  return { site: { id: 'site-a' }, $config: { api: { crossref: crossrefConfig } } } as any;
}

function row(overrides: Partial<{ versions: unknown[]; doiConfig: unknown }> = {}) {
  return {
    versions: overrides.versions ?? [
      { id: 'sv-2', status: 'PENDING' },
      { id: 'sv-1', status: 'PUBLISHED' },
    ],
    site: { doiConfig: 'doiConfig' in overrides ? overrides.doiConfig : { prefix: '10.99999' } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  server.prisma.submission.findFirst.mockResolvedValue(row());
  deposit.assembleDeposit.mockResolvedValue({
    issues: [warn],
    doi: 'ignored',
    xml: '<x/>',
    summary,
  });
});

describe('loadDoiReadiness', () => {
  it('reports not_configured without assembling when api.crossref is missing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadDoiReadiness(ctxWith(undefined), 'sub-1')).toEqual({ kind: 'not_configured' });
    expect(deposit.assembleDeposit).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('logs an invalid api.crossref block and still reports not_configured', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = ctxWith({ ...crossref, host: 'https://test.crossref.org' });
    expect(await loadDoiReadiness(ctx, 'sub-1')).toEqual({ kind: 'not_configured' });
    expect(error).toHaveBeenCalledWith(
      '[doi] api.crossref is invalid',
      expect.stringContaining('allowTestHost'),
    );
    expect(deposit.assembleDeposit).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('reports not_published without assembling when no version is PUBLISHED', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(
      row({ versions: [{ id: 'sv-2', status: 'PENDING' }] }),
    );
    expect(await loadDoiReadiness(ctxWith(crossref), 'sub-1')).toEqual({ kind: 'not_published' });
    expect(deposit.assembleDeposit).not.toHaveBeenCalled();
  });

  it('only looks the submission up on the current site', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(null);
    expect(await loadDoiReadiness(ctxWith(crossref), 'sub-1')).toEqual({ kind: 'not_published' });
    expect(server.prisma.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1', site_id: 'site-a' } }),
    );
  });

  it('is ready with the summary and warnings of the latest published version', async () => {
    const readiness = await loadDoiReadiness(ctxWith(crossref), 'sub-1');
    expect(readiness).toEqual({ kind: 'ready', prefix: '10.99999', warnings: [warn], summary });
    const [, versionId, opts] = deposit.assembleDeposit.mock.calls[0];
    expect(versionId).toBe('sv-1');
    expect(opts.doi).toMatch(/^10\.99999\/[a-z0-9]+$/);
    expect(opts.depositorEmail).toBe('doi@curvenote.com');
    expect(opts.resourceUrlBase).toBe('https://doi.example.com');
  });

  it('is blocked with only the blocking issues when nothing was assembled', async () => {
    deposit.assembleDeposit.mockResolvedValue({ issues: [block, warn], doi: 'ignored' });
    expect(await loadDoiReadiness(ctxWith(crossref), 'sub-1')).toEqual({
      kind: 'blocked',
      issues: [block],
    });
  });

  it('falls back to the deployment prefix when the site has no DOI config', async () => {
    server.prisma.submission.findFirst.mockResolvedValue(row({ doiConfig: null }));
    await loadDoiReadiness(ctxWith(crossref), 'sub-1');
    const [, , opts] = deposit.assembleDeposit.mock.calls[0];
    expect(opts.doi).toMatch(/^10\.62329\//);
  });

  it('generates a fresh DOI and batch id on every check', async () => {
    await loadDoiReadiness(ctxWith(crossref), 'sub-1');
    await loadDoiReadiness(ctxWith(crossref), 'sub-1');
    const [, , first] = deposit.assembleDeposit.mock.calls[0];
    const [, , second] = deposit.assembleDeposit.mock.calls[1];
    expect(first.doi).not.toBe(second.doi);
    expect(first.batchId).not.toBe(second.batchId);
  });

  it('resolves to unavailable instead of rejecting when the check throws', async () => {
    deposit.assembleDeposit.mockRejectedValue(new Error('CDN down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadDoiReadiness(ctxWith(crossref), 'sub-1')).toEqual({ kind: 'unavailable' });
  });
});
