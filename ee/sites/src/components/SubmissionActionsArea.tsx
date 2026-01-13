import {
  SubmissionActionsDropdown,
  getWorkflowState,
  getValidTransition,
  useDeploymentConfig,
} from '@curvenote/scms-core';
import type { SiteDTO } from '@curvenote/common';
import type { WorkflowTransition } from '@curvenote/scms-core';
import { useOptimisticTransition, useJobPolling, useTransitionFetcher } from '../hooks/index.js';

interface SubmissionActionsAreaProps {
  site: SiteDTO;
  item: any; //AugmentedSubmissionsListWithPagination['items'][0];
  canUpdateStatus: boolean;
  onActivityUpdate?: (activity: { date: string; by: { id: string; name: string } }) => void;
}

export function SubmissionActionsArea({
  site,
  item,
  canUpdateStatus,
  onActivityUpdate,
}: SubmissionActionsAreaProps) {
  const config = useDeploymentConfig();

  // Handle optimistic updates and transition state
  const {
    displayItem,
    activeTransition,
    setActiveTransition,
    applyOptimisticUpdate,
    handleTransitionSuccess,
    handleTransitionError,
    handleJobComplete,
    handleJobError,
  } = useOptimisticTransition({
    initialItem: item,
    initialTransition: item.transition as WorkflowTransition | null,
    onActivityUpdate,
  });

  // Handle transition fetcher
  const { submitTransition, isTransitioning } = useTransitionFetcher({
    onTransitionSuccess: handleTransitionSuccess,
    onTransitionError: handleTransitionError,
  });

  // Handle job polling
  useJobPolling({
    activeTransition,
    onJobComplete: handleJobComplete,
    onJobError: handleJobError,
  });

  function handleUpdateStatusSubmit(nextStatus: string) {
    if (!canUpdateStatus) return;

    const currentState = getWorkflowState(displayItem.workflow, displayItem.status);
    const transition = getValidTransition(displayItem.workflow, displayItem.status, nextStatus);

    if (!currentState || !transition) return;

    setTimeout(async () => {
      if (
        confirm(
          `Are you sure you want to ${transition.labels.action?.toLowerCase() ?? 'change'} "${displayItem.title}"?`,
        )
      ) {
        if (transition.requiresJob) {
          // Job-based transition: No immediate optimistic update, just set transition state
          setActiveTransition(transition);
        } else {
          // Immediate transition: Apply optimistic update
          applyOptimisticUpdate({
            status: nextStatus,
            transition: undefined,
          });
        }

        submitTransition(displayItem.version_id, nextStatus, `/app/sites/${site.name}/submissions`);
      }
    }, 300);
  }

  const baseUrl = config.renderServiceUrl || site.links.html;
  const currentState = displayItem.workflow.states[displayItem.status];
  const isPublished = currentState?.published || displayItem.published_version;
  const publishedUrl = isPublished
    ? `${baseUrl}/articles/${displayItem.published_version?.work_id}`
    : undefined;
  const previewUrl = !currentState?.published
    ? `${baseUrl}/previews/${displayItem.version_id}?preview=${displayItem.signature}`
    : undefined;

  return (
    <div className="flex flex-col justify-center items-right md:basis-48 shrink-0">
      <div className="flex flex-col items-center grow">
        <div className="flex items-center grow">
          <SubmissionActionsDropdown
            workflow={displayItem.workflow}
            keyStub={displayItem.id}
            workflowStateName={displayItem.status}
            transition={activeTransition || displayItem.transition}
            previewUrl={previewUrl}
            publishedUrl={publishedUrl}
            buildUrl={displayItem.links.build}
            onClickAction={handleUpdateStatusSubmit}
            canUpdateStatus={canUpdateStatus}
          />
        </div>
        <div className="h-[18px]">
          {((activeTransition?.requiresJob && activeTransition?.state?.jobId) ||
            isTransitioning) && (
            <div className="text-sm text-gray-500 animate-pulse">
              <div
                className="inline-block w-2 h-2 mr-[3px] bg-green-500 rounded align-middle"
                title="running..."
              />
              {activeTransition?.labels?.inProgress ?? 'running...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
