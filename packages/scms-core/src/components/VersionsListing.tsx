import type { SiteDTO, SubmissionVersionDTO } from '@curvenote/common';
import { formatDistance } from 'date-fns';
import { formatDate, formatTime } from '../utils/formatDate.js';
import { cn } from '../utils/cn.js';
import type { Workflow, WorkflowTransition } from '../workflow/types.js';
import { useFetcher } from 'react-router';
import { SubmissionActionsDropdown } from './SubmissionActionsDropdown.js';
import { ExternalLink } from 'lucide-react';
import { useDeploymentConfig } from '../providers/DeploymentProvider.js';

export function VersionsListing({
  workflow,
  site,
  items,
  canUpdateStatus,
  signature,
}: {
  workflow: Workflow;
  site: SiteDTO;
  items: (SubmissionVersionDTO & { transition?: WorkflowTransition })[];
  canUpdateStatus: boolean;
  signature: string;
}) {
  const fetcher = useFetcher();
  const config = useDeploymentConfig();

  function handleUpdateStatusSubmit(item: SubmissionVersionDTO, nextStatus: string) {
    if (!canUpdateStatus) return;

    setTimeout(() => {
      if (confirm(`Updating status from "${item.status}" to "${nextStatus}", are you sure?`)) {
        fetcher.submit(
          { submissionVersionId: item.id, status: nextStatus },
          { method: 'POST', action: `/app/sites/${site.name}/submissions` },
        );
        // revalidate();
      }
    }, 100);
  }

  return (
    <div className={cn('text-gray-800 dark:text-gray-200')}>
      <div className="space-y-6">
        {items.map((item) => {
          const baseUrl = config.renderServiceUrl || site.links.html;
          const previewUrl = `${baseUrl}/previews/${item.id}?preview=${signature}`;
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 px-2 pr-2 mr-2 -ml-2 hover:bg-gray-50 group"
            >
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block space-y-2 cursor-pointer grow "
                title="open a preview of this version"
              >
                <div className="space-y-2 grow">
                  <div>
                    <span className="font-medium group-hover:underline">
                      {formatDistance(new Date(item.date_created), new Date(), { addSuffix: true })}
                    </span>
                    <ExternalLink className="inline-block w-4 h-4 align-middle ml-[2px] mb-[3px]" />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 w-max">
                    <span
                      className="inline-block mr-2"
                      title={'Submitted by ' + item.submitted_by.name}
                    >
                      {item.submitted_by.name}
                    </span>
                    <span className="inline-block mr-2">{'-'}</span>
                    <span
                      className="inline-block mr-2"
                      title={formatDate(item.date_created) + ' ' + formatTime(item.date_created)}
                    >
                      Created {formatDate(item.date_created)}
                    </span>
                    {item.date_published && (
                      <span>
                        <span className="inline-block mr-2">{'-'}</span>
                        <span className="inline-block mr-2" title={formatDate(item.date_published)}>
                          Published {formatDate(item.date_published)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </a>
              <div className="text-right">
                <SubmissionActionsDropdown
                  workflow={workflow}
                  keyStub={item.id}
                  workflowStateName={item.status}
                  transition={item.transition}
                  previewUrl={previewUrl}
                  buildUrl={item.links.build}
                  onClickAction={(next) => handleUpdateStatusSubmit(item, next)}
                  canUpdateStatus={canUpdateStatus}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
