import { Link } from 'react-router';
import { formatDate, formatToNow, primitives, ui } from '@curvenote/scms-core';
import { ExternalLink } from 'lucide-react';
import type { dbGetWorksAndSubmissionVersions } from './db.server';

export type WorkCardDBO = Awaited<ReturnType<typeof dbGetWorksAndSubmissionVersions>>[0];

export function WorkListItem({
  work,
  workflows,
}: {
  work: WorkCardDBO;
  workflows: Record<string, any>;
}) {
  const lastActivity = work.submissions
    .map((submission) => submission.activity?.[0])
    .filter((activity) => !!activity)
    .slice()
    .sort((a, b) => Date.parse(b.date_created) - Date.parse(a.date_created))[0];

  const activityTime = lastActivity
    ? formatToNow(lastActivity.date_created, { addSuffix: true })
    : undefined;

  // Get the latest non-draft version info
  const latestVersion = work.versions.find((version) => !version.draft);
  const publishedDate = latestVersion?.date;

  // Check if work has submissions with slugs
  const hasSlug = work.submissions.some(
    (submission) => submission.slugs && submission.slugs.length > 0,
  );

  return (
    <div className="px-6 py-4">
      <div className="flex flex-col gap-1 items-start md:gap-6 md:flex-row">
        {/* Column 1: Title, Authors, DOI Links */}
        <div className="flex flex-col flex-grow gap-1">
          <div className="flex gap-2 items-start">
            <h3 className="font-normal leading-tight transition-colors line-clamp-2">
              <Link
                to={`/app/works/${work.id}`}
                className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {latestVersion?.title || 'Untitled Work'}
              </Link>
            </h3>
          </div>

          <div className="flex flex-wrap gap-1 text-sm text-gray-600 dark:text-gray-400">
            {latestVersion?.authors && latestVersion.authors.length > 0 && (
              <span>{latestVersion.authors.join(', ')}</span>
            )}
          </div>

          {/* DOI Links as Badges */}
          <div className="flex flex-wrap gap-2">
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
            {hasSlug && (
              <primitives.Chip
                className="text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300"
                title="Work has slug"
              >
                Slug
              </primitives.Chip>
            )}
          </div>
          {/* Show SubmissionVersionBadge for each submission with latest version */}
          <div className="flex flex-wrap gap-2 mt-2">
            {work.submissions
              .filter((submission) => submission.versions && submission.versions.length > 0)
              .map((submission) => {
                const latestNonDraftSubmissionVersion = submission.versions.filter(
                  (v) => v.status !== 'DRAFT',
                )[0]; // Already sorted by date_created desc

                // Guard against null/undefined collection
                if (!submission.collection?.workflow) return null;

                const workflow = workflows[submission.collection.workflow];

                if (!latestNonDraftSubmissionVersion || !workflow) return null;

                return (
                  <ui.SubmissionVersionBadge
                    key={`submission-badge-${submission.id}`}
                    submissionVersion={{
                      id: latestNonDraftSubmissionVersion.id,
                      status: latestNonDraftSubmissionVersion.status,
                      submission: {
                        id: submission.id,
                        collection: {
                          workflow: submission.collection.workflow,
                        },
                        site: {
                          name: submission.site.name,
                          title: submission.site.title,
                          metadata: submission.site.metadata,
                        },
                      },
                    }}
                    workflows={{ [submission.collection.workflow]: workflow }}
                    basePath={`/app/works/${work.id}`}
                    workVersionId={
                      latestNonDraftSubmissionVersion.work_version?.id || work.versions[0]?.id || ''
                    }
                    showSite
                    showLink={false}
                    variant="outline"
                  />
                );
              })}
          </div>
        </div>

        {/* Column 2: Activity and Date */}
        <div className="flex flex-col flex-shrink-0 items-center self-stretch w-48 pt-[1px]">
          <div className="flex flex-wrap gap-2 justify-center mb-2 w-full">
            {activityTime && (
              <primitives.Chip
                className="text-gray-500 border-[1px] border-gray-200 dark:border-gray-500 dark:text-gray-500"
                title={`Last activity was ${activityTime}`}
              >
                Activity {activityTime}
              </primitives.Chip>
            )}
          </div>

          {/* Published Date */}
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
        </div>
      </div>
    </div>
  );
}
