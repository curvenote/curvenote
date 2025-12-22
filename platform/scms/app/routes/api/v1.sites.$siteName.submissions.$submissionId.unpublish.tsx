import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId.unpublish';
import {
  withScopedSubmissionContext,
  dbGetWorkflowForSubmission,
  sites,
} from '@curvenote/scms-server';
import {
  error405,
  httpError,
  site,
  error404,
  getValidTransition,
  getTargetState,
} from '@curvenote/scms-core';
import { extensions } from '../../extensions/server';

export async function loader() {
  return error405();
}

/**
 * Request submission to be unpublished
 *
 * Currently, request body may be empty.
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withScopedSubmissionContext(args, [site.publishing]);
  if (args.request.method !== 'PUT') {
    throw httpError(405, 'Method Not Allowed');
  }

  // Unpublish the most recent published version; not necessarily the latest version
  const submissionVersion =
    await sites.submissions.versions.dbGetLatestSubmissionVersionFromSubmission(
      ctx.site.name,
      ctx.submission.id,
      'PUBLISHED',
    );
  if (!submissionVersion) throw error404();

  // Get the workflow for the current status
  const workflow = await dbGetWorkflowForSubmission(
    ctx,
    submissionVersion.submission.id,
    extensions,
  );

  const unpublishedState = Object.values(workflow.states).find((s) => s.name === 'UNPUBLISHED');
  if (!unpublishedState) {
    throw httpError(
      400,
      `The workflow ${workflow.name} does not have an UNPUBLISHED state, not sure how to unpublish`,
    );
  }

  // Find the unpublish transition
  const transition = getValidTransition(workflow, submissionVersion.status, 'UNPUBLISHED');
  if (!transition) {
    throw httpError(
      400,
      `No transition found from ${submissionVersion.status} to UNPUBLISHED in workflow ${workflow.name}`,
    );
  }
  const targetState = getTargetState(workflow, transition);
  const updated = await sites.submissions.versions.transition(
    ctx,
    submissionVersion,
    workflow,
    targetState.name,
  );

  const dto = await sites.submissions.formatSubmissionDTO(ctx, updated.submission, extensions);
  return dto;
}
