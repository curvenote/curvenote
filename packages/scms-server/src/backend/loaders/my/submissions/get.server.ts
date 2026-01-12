import type { ClientExtension } from '@curvenote/scms-core';
import { error401, error404, work } from '@curvenote/scms-core';
import type { Context } from '../../../context.server.js';
import { SiteContext } from '../../../context.site.server.js';
import { userHasWorkScope } from '../../../scopes.helpers.server.js';
import { dbGetSubmission, formatSubmissionDTO } from '../../sites/submissions/get.server.js';

export default async function (
  ctx: Context,
  extensions: ClientExtension[],
  submissionId: string | undefined,
) {
  if (!ctx.user) throw error401();
  if (!submissionId) throw error404();

  const submission = await dbGetSubmission({
    id: submissionId,
    work: {
      work_users: {
        some: {
          user_id: ctx.user.id,
        },
      },
    },
  });

  if (!submission) throw error404();
  const siteCtx = new SiteContext(ctx, submission.site);
  userHasWorkScope(ctx.user, work.submissions.read, submission.work_id);
  return formatSubmissionDTO(siteCtx, submission, extensions);
}
