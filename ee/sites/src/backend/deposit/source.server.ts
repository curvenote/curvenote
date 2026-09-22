import { getCdnBaseUrl, getCdnLocation, getConfig, getPage } from '@curvenote/cdn';
import { ensureTrailingSlash } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import { getPrismaClient, getSignedCDNQuery } from '@curvenote/scms-server';
import { extractPart } from 'myst-common';
import type { GenericParent } from 'myst-common';
import { mergeFrontmatter } from './overlay.js';
import { depositSourceSelect } from './select.server.js';
import type { DepositSourceRow } from './select.server.js';
import type { DepositSource } from './types.js';

export class DepositSourceError extends Error {
  constructor(
    readonly code: 'not_found' | 'no_cdn' | 'no_page',
    message: string,
  ) {
    super(message);
    this.name = 'DepositSourceError';
  }
}

type PageJson = NonNullable<Awaited<ReturnType<typeof getPage>>>;

/** Frontmatter-declared part first; otherwise the `{ part: 'abstract' }` block in the body. */
function abstractOf(page: PageJson): GenericParent | undefined {
  const declared = page.frontmatter.parts?.abstract?.mdast;
  if (declared) {
    return declared;
  }
  return extractPart(structuredClone(page.mdast), 'abstract');
}

/** True only for the `{ content: {...} }` shape mapper.ts reads; a bare string (e.g. 'CC-BY')
 * or any other shape isn't usable and must not shadow the CDN's license in the overlay. */
function isDepositShapedLicense(value: unknown): value is { content: Record<string, unknown> } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const content = (value as { content?: unknown }).content;
  return content !== null && typeof content === 'object' && !Array.isArray(content);
}

function citationsOf(page: PageJson): Record<string, string> {
  const data = page.references?.cite?.data ?? {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(data)) {
    if (entry.doi) {
      out[key] = entry.doi;
    }
  }
  return out;
}

async function loadCdn(ctx: Context, row: DepositSourceRow) {
  const { cdn, cdn_key } = row.work_version;
  if (!cdn || !cdn_key) {
    throw new DepositSourceError('no_cdn', 'The work version has no CDN content.');
  }
  // Precedent: loaders/works/create.server.ts
  const location = await getCdnLocation({ cdn, key: cdn_key });
  const baseUrl = await getCdnBaseUrl(location);
  const query = ctx.privateCdnUrls().has(ensureTrailingSlash(location.cdn))
    ? getSignedCDNQuery(ctx, baseUrl)
    : undefined;
  const host = { ...location, query };
  const config = await getConfig(host);
  const page = await getPage(host, { loadIndexPage: true });
  if (!page) {
    throw new DepositSourceError('no_page', 'The index page was not found on the CDN.');
  }
  return { project: config?.projects?.[0], page };
}

/** IO only: DB row, CDN config and index page, site DOI config. The mapper does the rest. */
export async function loadDepositSource(
  ctx: Context,
  submissionVersionId: string,
): Promise<DepositSource> {
  const prisma = await getPrismaClient();
  const row = await prisma.submissionVersion.findUnique({
    where: { id: submissionVersionId },
    select: depositSourceSelect,
  });
  if (!row) {
    throw new DepositSourceError(
      'not_found',
      `Submission version ${submissionVersionId} not found.`,
    );
  }
  const { project, page } = await loadCdn(ctx, row);
  const metadata = (row.work_version.metadata ?? {}) as { [key: string]: unknown };
  // `metadata.license` is a top-level key written by CLI/ETL passthrough, not under
  // frontmatter.myst. It only carries the deposit-shaped `{ content: {...} }` object on some
  // rows; on others it's a bare string (e.g. 'CC-BY') that mapper.ts can't use. A truthy string
  // must not shadow the CDN's `{ content: { CC, url } }` license, so only overlay it when it's
  // already the object shape the mapper expects.
  const dbLayer = {
    ...((metadata['frontmatter.myst'] as object | undefined) ?? {}),
    ...(isDepositShapedLicense(metadata.license) ? { license: metadata.license } : {}),
  };
  return {
    submissionVersionId: row.id,
    siteId: row.submission.site_id,
    kindName: row.submission.kind.name,
    doiConfig: row.submission.site.doiConfig,
    dates: {
      submissionPublished: row.submission.date_published ?? undefined,
      versionPublished: row.date_published ?? undefined,
      workVersion: row.work_version.date ?? undefined,
    },
    frontmatter: mergeFrontmatter(dbLayer, project, page.frontmatter),
    abstractMdast: abstractOf(page),
    citations: citationsOf(page),
  };
}
