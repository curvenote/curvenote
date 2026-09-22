import { generateDoi } from 'crossref-utils-sdk';
import { uuidv7 } from 'uuidv7';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import { crossrefCredentialsFromConfig } from '../crossref/client.server.js';
import { assembleDeposit } from './assemble.server.js';
import type { DepositIssue, DepositSummary } from './types.js';

export type DoiReadiness =
  | { kind: 'not_configured' }
  | { kind: 'not_published' }
  /** The check itself failed (CDN unreachable, unexpected error); nothing is known about the data. */
  | { kind: 'unavailable' }
  | { kind: 'blocked'; issues: DepositIssue[] }
  | { kind: 'ready'; prefix: string; warnings: DepositIssue[]; summary: DepositSummary };

const PUBLISHED = 'PUBLISHED';

async function dbLoadSubmissionForDoi(siteId: string, submissionId: string) {
  const prisma = await getPrismaClient();
  return prisma.submission.findFirst({
    where: { id: submissionId, site_id: siteId },
    select: {
      versions: {
        orderBy: { date_created: 'desc' },
        select: { id: true, status: true },
      },
      site: { select: { doiConfig: { select: { prefix: true } } } },
    },
  });
}

async function checkDoiReadiness(ctx: SiteContext, submissionId: string): Promise<DoiReadiness> {
  let depositorEmail: string;
  let deploymentPrefix: string;
  try {
    const creds = crossrefCredentialsFromConfig(ctx.$config);
    depositorEmail = creds.depositorEmail;
    deploymentPrefix = creds.prefix;
  } catch (error: any) {
    console.error('[doi]', error?.message);
    return { kind: 'not_configured' };
  }

  const row = await dbLoadSubmissionForDoi(ctx.site.id, submissionId);
  const published = row?.versions.find((version) => version.status === PUBLISHED);
  if (!row || !published) {
    return { kind: 'not_published' };
  }

  // The site's own prefix when it has a DOI config; otherwise the mapper blocks with
  // site_not_active anyway and the deployment prefix only gives assembleDeposit a value.
  const prefix = row.site.doiConfig?.prefix ?? deploymentPrefix;
  const assembled = await assembleDeposit(ctx, published.id, {
    doi: generateDoi(prefix),
    batchId: uuidv7(),
    depositorEmail,
  });
  if (!assembled.summary) {
    return {
      kind: 'blocked',
      issues: assembled.issues.filter((issue) => issue.severity === 'blocking'),
    };
  }
  return { kind: 'ready', prefix, warnings: assembled.issues, summary: assembled.summary };
}

/**
 * Can the latest published version of a submission be registered, and what would be sent.
 * Assembles the full deposit (DB + CDN config + index page) so the answer is the one Register
 * gets. The DOI and batch id are throwaway: nothing is reserved or written, Crossref is never
 * called. Never rejects, so the detail page can stream it without an error boundary.
 */
export async function loadDoiReadiness(
  ctx: SiteContext,
  submissionId: string,
): Promise<DoiReadiness> {
  try {
    return await checkDoiReadiness(ctx, submissionId);
  } catch (error: any) {
    console.error('[doi] readiness check failed', submissionId, error?.message);
    return { kind: 'unavailable' };
  }
}
