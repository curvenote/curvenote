import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { withAppSiteContext } from '@curvenote/scms-server';
import {
  site as siteScopes,
  submissionVersionsSeeAllUrl,
  trimSubmissionVersionTimeline,
} from '@curvenote/scms-core';
import { dbLoadSubmissionVersionsTimeline } from './db.server.js';

/**
 * Resource route powering the submissions-listing version-timeline hover card.
 *
 * JSON-only, no default export. Contract:
 *   GET /app/sites/:siteName/submissions/:submissionId/versions
 *     200 -> TrimmedVersionTimeline<VersionTimelineEntry>   (non-draft, newest first, max 8 visible)
 *     400 -> { error }                              (missing route param)
 *     401/403 -> auth/scope failure (NOT a redirect — see below)
 *     404 -> { error: 'Submission not found' }      (cross-site or unknown id)
 *
 * Auth: uses the default `withAppSiteContext` policy (no `redirect: true`)
 * so unauthenticated/unscoped clients receive a plain HTTP status the
 * client cache can render as "Could not load versions" instead of
 * silently following a 302 → /app and trying to parse HTML as JSON.
 *
 * The bulk of the work is a single nested Prisma call in `db.server.ts`;
 * this loader only wraps that with the tenancy guard and a thin envelope.
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list]);

  const siteName = args.params.siteName;
  const submissionId = args.params.submissionId;
  if (!siteName || !submissionId) {
    return data({ error: 'Missing submission id' }, { status: 400 });
  }

  const versions = await dbLoadSubmissionVersionsTimeline(ctx, submissionId);
  if (versions === null) {
    return data({ error: 'Submission not found' }, { status: 404 });
  }

  return data(
    trimSubmissionVersionTimeline(versions, submissionVersionsSeeAllUrl(siteName, submissionId)),
  );
}
