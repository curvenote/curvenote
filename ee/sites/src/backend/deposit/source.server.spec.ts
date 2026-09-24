// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cdn = vi.hoisted(() => ({
  getCdnLocation: vi.fn(),
  getCdnBaseUrl: vi.fn(),
  getConfig: vi.fn(),
  getPage: vi.fn(),
}));
vi.mock('@curvenote/cdn', () => cdn);
const server = vi.hoisted(() => ({ prisma: { submissionVersion: { findUnique: vi.fn() } } }));
vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: async () => server.prisma,
  getSignedCDNQuery: () => 'Signature=abc',
}));

import { loadDepositSource } from './source.server.js';

const ctx = { privateCdnUrls: () => new Set(['https://prv.curvenote.dev/']) } as any;

function row() {
  return {
    id: 'sv-1',
    date_published: '2022-10-12T00:00:00.000Z',
    work_version: {
      cdn: 'https://prv.curvenote.dev/',
      cdn_key: 'abc.def',
      title: 'DB title',
      date: '2021-11-10',
      doi: null,
      metadata: {
        'frontmatter.myst': { title: 'Edited title', authors: [{ name: 'Edited Author' }] },
      },
      author_details: [],
      work: { doi: null },
    },
    submission: {
      id: 'sub-1',
      site_id: 'site-a',
      date_published: '2022-10-11T00:00:00.000Z',
      doi: null,
      kind: {
        name: 'Article',
        content: { title: 'Research Article' },
        doi_content_type: 'PREPRINT',
      },
      site: { doiConfig: { status: 'ACTIVE', prefix: '10.62329', role: null } },
    },
  };
}

const page = {
  frontmatter: { title: 'Page title', date: '2020-01-01', parts: {} },
  mdast: {
    type: 'root',
    children: [
      {
        type: 'block',
        data: { part: 'abstract' },
        children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Abstract text' }] }],
      },
    ],
  },
  references: {
    cite: {
      order: ['a'],
      data: {
        a: { doi: '10.1/x', html: '', label: 'a', enumerator: '1' },
        b: { html: '', label: 'b', enumerator: '2' },
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  cdn.getCdnLocation.mockResolvedValue({ cdn: 'https://prv.curvenote.dev/', key: 'abc.def' });
  cdn.getCdnBaseUrl.mockResolvedValue('https://prv.curvenote.dev/abc/def/');
  cdn.getConfig.mockResolvedValue({
    projects: [
      { title: 'Project title', license: { content: { CC: true, url: 'https://cc/by' } } },
    ],
  });
  cdn.getPage.mockResolvedValue(page);
});

describe('loadDepositSource', () => {
  it('merges DB, project and page and extracts abstract and citation DOIs', async () => {
    server.prisma.submissionVersion.findUnique.mockResolvedValue(row());
    const source = await loadDepositSource(ctx, 'sv-1');
    expect(source.frontmatter.title).toBe('Edited title');
    expect(source.frontmatter.license).toEqual({ content: { CC: true, url: 'https://cc/by' } });
    expect(source.dates).toEqual({
      submissionPublished: '2022-10-11T00:00:00.000Z',
      versionPublished: '2022-10-12T00:00:00.000Z',
      workVersion: '2021-11-10',
    });
    expect(source.abstractMdast?.type).toBe('root');
    expect((source.abstractMdast as any).children[0].data.part).toBe('abstract');
    expect(source.citations).toEqual({ a: '10.1/x' });
    expect(source.doiConfig).toEqual({ status: 'ACTIVE', prefix: '10.62329', role: null });
    expect(source.kind).toEqual({ title: 'Research Article', doiContentType: 'PREPRINT' });
    expect(cdn.getConfig).toHaveBeenCalledWith({
      cdn: 'https://prv.curvenote.dev/',
      key: 'abc.def',
      query: 'Signature=abc',
    });
    expect(cdn.getPage).toHaveBeenCalledWith(
      { cdn: 'https://prv.curvenote.dev/', key: 'abc.def', query: 'Signature=abc' },
      { loadIndexPage: true },
    );
  });

  it('prefers a frontmatter part over the body block', async () => {
    server.prisma.submissionVersion.findUnique.mockResolvedValue(row());
    cdn.getPage.mockResolvedValue({
      ...page,
      frontmatter: {
        ...page.frontmatter,
        parts: { abstract: { mdast: { type: 'root', children: [] } } },
      },
    });
    const source = await loadDepositSource(ctx, 'sv-1');
    expect(source.abstractMdast).toEqual({ type: 'root', children: [] });
  });

  it('keeps the CDN licence when metadata.license is a bare string', async () => {
    server.prisma.submissionVersion.findUnique.mockResolvedValue({
      ...row(),
      work_version: {
        ...row().work_version,
        metadata: { ...row().work_version.metadata, license: 'CC-BY' },
      },
    });
    const source = await loadDepositSource(ctx, 'sv-1');
    expect(source.frontmatter.license).toEqual({ content: { CC: true, url: 'https://cc/by' } });
  });

  it('overlays a deposit-shaped metadata.license over the CDN licence', async () => {
    const dbLicense = { content: { CC: true, url: 'https://cc/db-license' } };
    server.prisma.submissionVersion.findUnique.mockResolvedValue({
      ...row(),
      work_version: {
        ...row().work_version,
        metadata: { ...row().work_version.metadata, license: dbLicense },
      },
    });
    const source = await loadDepositSource(ctx, 'sv-1');
    expect(source.frontmatter.license).toEqual(dbLicense);
  });

  it('fails with not_found and no_cdn', async () => {
    server.prisma.submissionVersion.findUnique.mockResolvedValue(null);
    await expect(loadDepositSource(ctx, 'missing')).rejects.toMatchObject({ code: 'not_found' });
    server.prisma.submissionVersion.findUnique.mockResolvedValue({
      ...row(),
      work_version: { ...row().work_version, cdn: null },
    });
    await expect(loadDepositSource(ctx, 'sv-1')).rejects.toMatchObject({ code: 'no_cdn' });
  });
});
