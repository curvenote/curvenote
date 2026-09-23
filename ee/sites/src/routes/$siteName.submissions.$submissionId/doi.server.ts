import { data } from 'react-router';
import { scopes } from '@curvenote/scms-core';
import {
  getPrismaClient,
  userHasScope,
  userHasSiteScope,
  type SiteContextWithUser,
} from '@curvenote/scms-server';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import type { DoiDeps } from '../../backend/doi/types.js';
import { startRegistration } from '../../backend/registration/start.server.js';

export type RegisterDoiActionData = { info?: string; error?: string };

/**
 * Register (and Retry) on the submission detail DOI row. The route action only requires
 * site.submissions.update; registering also needs site.doi.register, which only the site's
 * ADMIN role holds, plus the feature flag. The version is resolved on the server from the URL's
 * submission, never taken from the form.
 */
export async function actionRegisterDoi(ctx: SiteContextWithUser, submissionId: string) {
  if (!userHasSiteScope(ctx.user, scopes.site.doi.register, ctx.site.id)) {
    return data(
      { error: 'You do not have permission to register DOIs on this site.' },
      { status: 403 },
    );
  }
  if (!userHasScope(ctx.user, scopes.app.sites.doi.feature)) {
    return data({ error: 'DOI registration is not available for this account.' }, { status: 403 });
  }
  let deps: DoiDeps;
  try {
    deps = { prisma: await getPrismaClient(), creds: crossrefCredentialsFromConfig(ctx.$config) };
  } catch (error: any) {
    console.error('[doi]', error?.message);
    return data(
      { error: 'DOI registration is not configured on this deployment.' },
      { status: 500 },
    );
  }
  const result = await startRegistration(ctx, deps, {
    siteId: ctx.site.id,
    submissionId,
    actor: { userId: ctx.user.id, isSystemAdmin: userHasScope(ctx.user, scopes.system.admin) },
  });
  if (!result.ok) {
    const details = (result.issues ?? []).map((issue) => issue.message);
    return data({ error: [result.error, ...details].join(' ') }, { status: result.status });
  }
  return data({ info: `DOI registration started for ${result.doi}.` });
}
