import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId.publish';
import { z } from 'zod';
import { error404, error405, httpError, site, getValidTransition } from '@curvenote/scms-core';
import {
  validate,
  withScopedSubmissionContext,
  dbGetWorkflowForSubmission,
  sites,
} from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

export async function loader() {
  return error405();
}

export const CreatePublishPutBodySchema = z.object({
  // Date published; if value is already set on SubmissionVersion, this date will be ignored
  date: z.iso.date().optional(),
});

/**
 * Request submission to be published
 *
 * Currently, request body may be empty.
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withScopedSubmissionContext(args, [site.publishing]);
  if (args.request.method !== 'PUT') {
    throw httpError(405, 'Method Not Allowed');
  }

  const submissionVersion =
    await sites.submissions.versions.dbGetLatestSubmissionVersionFromSubmission(
      ctx.site.name,
      ctx.submission.id,
    );
  if (!submissionVersion) throw error404();

  // Get the workflow for the current status
  const workflow = await dbGetWorkflowForSubmission(
    ctx,
    submissionVersion.submission.id,
    extensions,
  );

  // Get the published state for this workflow
  // generalising a little to allow for multiple published states
  const publishedStates = Object.values(workflow.states).filter((s) => s.published);
  if (publishedStates.length === 0) {
    throw httpError(400, `The workflow ${workflow.name} does not have a published state`);
  }
  let targetState = publishedStates.find((s) => s.name === 'PUBLISHED');
  if (!targetState) {
    targetState = publishedStates[0];
    console.warn(
      `The workflow ${workflow.name} has does not have a state named PUBLISHED, but does have ${publishedStates.map((p) => p.name)} marked as published states, using the first one`,
    );
  }

  // verify the published state
  const transition = getValidTransition(workflow, submissionVersion.status, targetState.name);
  if (!transition) {
    throw httpError(
      400,
      `No transition found from ${submissionVersion.status} to ${targetState.name} in workflow ${workflow.name}`,
    );
  }

  let body: Record<string, any>;
  try {
    body = await args.request.json();
  } catch {
    body = {};
  }
  const { date } = validate(CreatePublishPutBodySchema, body);

  const updated = await sites.submissions.versions.transition(
    ctx,
    submissionVersion,
    workflow,
    targetState.name,
    date, // Already an ISO string from the validated schema
  );

  const dto = await sites.submissions.formatSubmissionDTO(ctx, updated.submission, extensions);
  return dto;
}
