import type { Workflow, ClientExtension } from '@curvenote/scms-core';
import { getWorkflows, registerExtensionWorkflows } from '@curvenote/scms-core';
import { getPrismaClient } from '../backend/prisma.server.js';
import type { SiteContext } from '../backend/context.site.server.js';

/**
 * Given the submission ID, we need to determine the workflow in use based on the collection.
 * And then that return that workflow object.
 *
 * @param submissionId
 */
export async function dbGetWorkflowForSubmission(
  ctx: SiteContext,
  submissionId: string,
  extensions: ClientExtension[],
): Promise<Workflow> {
  const prisma = await getPrismaClient();
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      collection: { select: { workflow: true } },
      site: { select: { default_workflow: true } },
    },
  });

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`);
  }

  // Get the workflow type from the collection, or fall back to the site's default workflow
  const workflowType = submission.collection?.workflow || submission.site.default_workflow;
  const workflows = getWorkflows(ctx.$config, registerExtensionWorkflows(extensions));
  return workflows[workflowType] ?? workflows.SIMPLE;
}
