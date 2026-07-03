import { Link } from 'react-router';
import {
  formatDate,
  formatToNow,
  primitives,
  ui,
  WorkVersionTimelineHoverCard,
  SubmissionVersionTimelineHoverCard,
  workVersionsTimelineUrl,
  submissionVersionsTimelineUrl,
} from '@curvenote/scms-core';
import { ExternalLink, Timeline } from 'lucide-react';
import type { dbGetWorksAndSubmissionVersions } from './db.server';
import type { WorkListCheckService } from './WorkCheckSummaries';
import { WorkCheckSummaries } from './WorkCheckSummaries';

export type WorkCardDBO = Awaited<ReturnType<typeof dbGetWorksAndSubmissionVersions>>[0];

export function WorkListItem({
  work,
  workflows,
  checkServices,
}: {
  work: WorkCardDBO;
  workflows: Record<string, any>;
  checkServices: WorkListCheckService[];
}) {
  const lastActivity = work.submissions
    .map((submission) => submission.activity?.[0])
    .filter((activity) => !!activity)
    .slice()
    .sort((a, b) => Date.parse(b.date_created) - Date.parse(a.date_created))[0];

  const activityTime = lastActivity
    ? formatToNow(lastActivity.date_created, { addSuffix: true })
    : undefined;

  // Get the latest work version (versions are ordered date_created desc)
  const latestWorkVersion = work.versions[0];

  // Get the latest non-draft version info for title/authors/published
  const latestVersion = work.versions.find((version) => !version.draft);
  const publishedDate = latestVersion?.date;

  const workVersionsUrl = workVersionsTimelineUrl(work.id);
  const showWorkDoi = Boolean(work.doi && work.doi !== latestVersion?.doi);
  const showVersionDoi = Boolean(latestVersion?.doi);
  const submissionsWithBadges = work.submissions
    .map((submission) => {
      const latestNonDraftSubmissionVersion = submission.versions?.[0];
      const workflowKey = submission.collection?.workflow;
      const workflow = workflowKey ? workflows[workflowKey] : undefined;
      if (!latestNonDraftSubmissionVersion || !workflowKey || !workflow) return null;
      return { submission, latestNonDraftSubmissionVersion, workflowKey, workflow };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);
  const showBadgeRow = showWorkDoi || showVersionDoi || submissionsWithBadges.length > 0;

  return (
    <div className="px-6 py-4">
      <div className="flex flex-col gap-1 items-start md:gap-6 md:flex-row">
        {/* Column 1: Title, Authors, DOI Links */}
        <div className="flex flex-col flex-grow gap-1">
          <div className="flex flex-wrap gap-2 items-start">
            <h3 className="font-normal leading-tight transition-colors line-clamp-2">
              <Link
                to={`${work.id}`}
                className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {latestVersion?.title || latestWorkVersion?.title || 'Untitled Work'}
              </Link>
            </h3>
          </div>

          <div className="flex flex-wrap gap-1 text-sm text-gray-600 dark:text-gray-400">
            {latestVersion?.authors && latestVersion.authors.length > 0 && (
              <span>{latestVersion.authors.join(', ')}</span>
            )}
          </div>

          {showBadgeRow && (
            <div className="flex flex-wrap gap-2 items-center mt-2">
              {work.doi && work.doi !== latestVersion?.doi && (
                <ui.Badge variant="outline-muted" asChild>
                  <a
                    href={work.doi.startsWith('http') ? work.doi : `https://doi.org/${work.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex gap-1 items-center text-xs"
                  >
                    Work DOI: {work.doi.replace('https://doi.org/', '')}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </ui.Badge>
              )}
              {latestVersion?.doi && (
                <ui.Badge variant="outline-muted" asChild>
                  <a
                    href={
                      latestVersion.doi.startsWith('http')
                        ? latestVersion.doi
                        : `https://doi.org/${latestVersion.doi}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex gap-1 items-center text-xs"
                  >
                    DOI: {latestVersion.doi.replace('https://doi.org/', '')}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </ui.Badge>
              )}
              {submissionsWithBadges.map(
                ({ submission, latestNonDraftSubmissionVersion, workflowKey, workflow }) => {
                  // `dbGetWorksAndSubmissionVersions` already filters out DRAFT submission versions.
                  return (
                    <SubmissionVersionTimelineHoverCard
                      key={`submission-badge-${submission.id}`}
                      versionsUrl={submissionVersionsTimelineUrl(
                        submission.site.name,
                        submission.id,
                      )}
                      title={`Submissions at ${submission.site.title || submission.site.name}`}
                    >
                      <ui.SubmissionVersionBadge
                        submissionVersion={{
                          id: latestNonDraftSubmissionVersion.id,
                          status: latestNonDraftSubmissionVersion.status,
                          submission: {
                            id: submission.id,
                            collection: {
                              workflow: workflowKey,
                            },
                            site: {
                              name: submission.site.name,
                              title: submission.site.title,
                              metadata: submission.site.metadata,
                            },
                          },
                        }}
                        workflows={{ [workflowKey]: workflow }}
                        basePath={`/app/works/${work.id}`}
                        workVersionId={
                          latestNonDraftSubmissionVersion.work_version?.id ||
                          latestVersion?.id ||
                          ''
                        }
                        showSite
                        showLink={false}
                        variant="outline"
                      />
                    </SubmissionVersionTimelineHoverCard>
                  );
                },
              )}
            </div>
          )}
          <WorkCheckSummaries
            workId={work.id}
            checkRunSummary={work.checkRunSummary}
            checkServices={checkServices}
          />
        </div>

        {/* Column 2: Activity and Date */}
        <div className="flex flex-col flex-shrink-0 items-start self-stretch w-48 pt-[1px]">
          <div className="flex flex-wrap gap-2 justify-start mb-2 w-full">
            {activityTime && (
              <primitives.Chip
                className="text-gray-500 border-[1px] border-gray-200 dark:border-gray-500 dark:text-gray-500"
                title={`Last activity was ${activityTime}`}
              >
                Activity {activityTime}
              </primitives.Chip>
            )}
          </div>

          {publishedDate && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Published: {formatDate(publishedDate)}
            </div>
          )}
          {!publishedDate && latestVersion && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Created: {formatDate(latestVersion.date_created)}
            </div>
          )}

          <WorkVersionTimelineHoverCard
            versionsUrl={workVersionsUrl}
            workId={work.id}
            checkServices={checkServices}
            align="end"
            side="left"
            title="Work Timeline"
          >
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
            >
              <Timeline className="size-3.5 shrink-0" aria-hidden />
              Timeline
            </button>
          </WorkVersionTimelineHoverCard>
        </div>
      </div>
    </div>
  );
}
