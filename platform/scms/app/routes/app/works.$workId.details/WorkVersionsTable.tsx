import { cn, formatDate, ui } from '@curvenote/scms-core';
import type { WorkVersionWithSubmissionVersions } from '../works.$workId/types';
import type { Workflow } from '@curvenote/scms-core';

export function WorkVersionsTable({
  workflows,
  versions,
  basePath,
}: {
  workflows: Record<string, Workflow>;
  versions: WorkVersionWithSubmissionVersions[];
  basePath: string;
}) {
  return (
    <>
      <table className="w-full text-left table-fixed dark:text-white">
        <thead>
          <tr className="border-gray-400 border-b-[1px] pointer-events-none">
            <th className="px-4 py-2 w-[180px]">Date</th>
            <th className="px-4 py-2 min-w-[250px]">Submission Status</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v, idx) => {
            // Each work version may have multiple submission versions, attached to different submisisons and/or sites
            // but we already have the information in the versions array, so we can just group by submission

            // right now we are assuming that there is a 1-to-1 workVersion-submissionVersion relationship per site
            // so if ther are multiple submission versions to a site we expect an independent work version for each
            // there may be multiple submissions to a site, and there is a history of submission versions that it may be
            // important to surface but that is a TODO and needs more UI to convey
            // TODO: the badge should show a popup with user facing information about the submission and submission version history
            return (
              <tr key={v.id} className="border-b-[1px] border-gray-300 last:border-none">
                <td
                  className={cn('px-4 py-3 text-sm align-middle whitespace-nowrap', {
                    'opacity-50': idx !== 0,
                    'font-medium': idx === 0,
                  })}
                >
                  {formatDate(v.date_created, 'MMM dd, y h:mm a ')}
                </td>
                <td
                  className={cn('px-4 py-3 text-left align-middle', {
                    'opacity-50': idx !== 0,
                  })}
                >
                  {v.submissionVersions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {v.submissionVersions.map((sv) => (
                        <ui.SubmissionVersionBadge
                          key={`submission-badge-${v.id}-${sv.id}`}
                          submissionVersion={sv}
                          workflows={workflows}
                          basePath={basePath}
                          workVersionId={v.id}
                          showSite
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm italic text-gray-400">No submissions</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
