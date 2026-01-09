import type { ActionFunctionArgs } from 'react-router';
import { data, Outlet } from 'react-router';
import { sites, withAppSiteContext } from '@curvenote/scms-server';
import { getValidTransition, getWorkflow, TrackEvent, scopes } from '@curvenote/scms-core';
import type { WorkflowTransition } from '@curvenote/scms-core';

// Helper function to get specific transition event names
function getTransitionEventName(
  targetStateName: string,
  transition: WorkflowTransition,
): string | null {
  const transitionName = transition.name;

  // Map common transition names to specific event names
  switch (transitionName) {
    case 'publish':
      return 'Submission Published';
    case 'unpublish':
      return 'Submission Unpublished';
    case 'reject':
      return 'Submission Rejected';
    case 'reset':
      return 'Submission Reset';
    case 'approve':
      return 'Submission Approved';
    case 'withdraw':
      return 'Submission Withdrawn';
    default:
      // For other transitions, use a generic pattern
      return `Submission ${transitionName.charAt(0).toUpperCase() + transitionName.slice(1)}`;
  }
}

export const action = async (args: ActionFunctionArgs) => {
  const ctx = await withAppSiteContext(args, [scopes.site.submissions.update]);

  if (args.request.method === 'POST') {
    const form = await args.request.formData();
    const submissionVersionId = form.get('submissionVersionId')?.toString();
    const targetStateName = form.get('status') as string | null;
    if (!submissionVersionId || !targetStateName) {
      return data(
        {
          error: {
            message: 'Missing submissionVersionId or status',
          },
        },
        { status: 400 },
      );
    }

    // Get the current submission version to check its status
    const submissionVersion = await sites.submissions.versions.dbGetSubmissionVersion({
      id: submissionVersionId,
    });
    if (!submissionVersion) {
      return data(
        {
          error: {
            message: 'Submission version not found',
          },
        },
        { status: 404 },
      );
    }

    // Get the workflow for the current status
    const workflowName = submissionVersion.submission.collection.workflow;
    const workflow = getWorkflow(ctx.$config, [], workflowName);
    if (!workflow) {
      return data(
        {
          error: {
            message: `Workflow ${workflowName} from collection ${submissionVersion.submission.collection.name} not found`,
          },
        },
        { status: 400 },
      );
    }

    // Check if the transition is valid
    const transition = getValidTransition(workflow, submissionVersion.status, targetStateName);
    if (!transition) {
      return data(
        {
          error: {
            message: `Invalid transition from ${submissionVersion.status} to ${targetStateName}`,
          },
        },
        { status: 400 },
      );
    }

    try {
      // Update the submission version status
      const item = await sites.submissions.versions.transition(
        ctx,
        submissionVersion,
        workflow,
        targetStateName,
      );

      const transitionEvent = getTransitionEventName(targetStateName, transition);

      if (transitionEvent) {
        await ctx.trackEvent(transitionEvent as TrackEvent, {
          submissionId: submissionVersion.submission.id,
          submissionVersionId: submissionVersion.id,
          fromStatus: submissionVersion.status,
          toStatus: targetStateName,
          workflow: workflowName,
          collectionId: submissionVersion.submission.collection.id,
          collectionName: submissionVersion.submission.collection.name,
          requiresJob: transition.requiresJob,
        });
      } else {
        await ctx.trackEvent(TrackEvent.SUBMISSION_STATUS_CHANGED, {
          submissionId: submissionVersion.submission.id,
          submissionVersionId: submissionVersion.id,
          fromStatus: submissionVersion.status,
          toStatus: targetStateName,
          workflow: workflowName,
          collectionId: submissionVersion.submission.collection.id,
          collectionName: submissionVersion.submission.collection.name,
        });
      }

      await ctx.analytics.flush();

      return { success: true, item };
    } catch (err: any) {
      return data(
        {
          error: {
            message: err.message ?? err.statusText ?? err.toString(),
          },
        },
        { status: err.status ?? 500 },
      );
    }
  }
  return data(
    {
      error: {
        message: 'Method not allowed',
      },
    },
    { status: 405 },
  );
};

export default function Layout() {
  return <Outlet />;
}
