import { generateDoi } from 'crossref-utils-sdk';
import { uuidv7 } from 'uuidv7';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import { assembleDeposit } from '../../backend/deposit/assemble.server.js';
import type { DepositIssue } from '../../backend/deposit/types.js';

export type SubmissionDoiPageState =
  | { kind: 'not_configured' }
  | { kind: 'not_published' }
  | { kind: 'assembled'; doi: string; issues: DepositIssue[]; xml?: string };

export type SubmissionDoiPageData = {
  site: { name: string; title: string };
  submission: { id: string; title: string };
  state: SubmissionDoiPageState;
};

const PUBLISHED = 'PUBLISHED';

async function dbLoadSubmissionForDoi(siteId: string, submissionId: string) {
  const prisma = await getPrismaClient();
  return prisma.submission.findFirst({
    where: { id: submissionId, site_id: siteId },
    select: {
      id: true,
      versions: {
        orderBy: { date_created: 'desc' },
        select: { id: true, status: true, work_version: { select: { title: true } } },
      },
      site: { select: { doiConfig: { select: { prefix: true } } } },
    },
  });
}

/**
 * Preview only: the DOI and batch id are generated on every load and written nowhere. The real
 * DOI is reserved on Register (CN-2581). The loader never calls Crossref.
 */
export async function loadSubmissionDoiPage(
  ctx: SiteContext,
  submissionId: string,
): Promise<SubmissionDoiPageData | null> {
  const row = await dbLoadSubmissionForDoi(ctx.site.id, submissionId);
  if (!row) {
    return null;
  }
  const site = { name: ctx.site.name, title: ctx.site.title };
  const submission = { id: row.id, title: row.versions[0]?.work_version.title ?? row.id };

  let depositorEmail: string;
  let deploymentPrefix: string;
  try {
    const creds = crossrefCredentialsFromConfig(ctx.$config);
    depositorEmail = creds.depositorEmail;
    deploymentPrefix = creds.prefix;
  } catch (error: any) {
    console.error('[doi]', error?.message);
    return { site, submission, state: { kind: 'not_configured' } };
  }

  const published = row.versions.find((version) => version.status === PUBLISHED);
  if (!published) {
    return { site, submission, state: { kind: 'not_published' } };
  }

  // The site's own prefix when it has a DOI config; otherwise the mapper blocks with
  // site_not_active anyway and the deployment prefix only gives assembleDeposit a value.
  const doi = generateDoi(row.site.doiConfig?.prefix ?? deploymentPrefix);
  const assembled = await assembleDeposit(ctx, published.id, {
    doi,
    batchId: uuidv7(),
    depositorEmail,
  });
  return {
    site,
    submission,
    state: { kind: 'assembled', doi, issues: assembled.issues, xml: assembled.xml },
  };
}
