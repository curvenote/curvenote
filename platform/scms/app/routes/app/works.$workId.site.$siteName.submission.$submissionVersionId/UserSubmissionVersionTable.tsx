import { formatDate, ui, cn } from '@curvenote/scms-core';
import type { Workflow } from '@curvenote/scms-core';
import { Link } from 'react-router';

type SubmissionVersionRow = {
  id: string;
  status: string;
  date_created: Date | string;
  submission: {
    id: string;
    site: {
      name: string;
      title?: string;
      metadata?: any;
    };
  };
  work_version?: {
    work_id?: string;
  };
};

type UserSubmissionVersionTableProps = {
  submissionVersions: SubmissionVersionRow[];
  workflow: Workflow;
  viewingSubmissionVersionId: string;
  workId: string;
  siteName: string;
};

export function UserSubmissionVersionTable({
  submissionVersions,
  workflow,
  viewingSubmissionVersionId,
  workId,
  siteName,
}: UserSubmissionVersionTableProps) {
  return (
    <table className="w-full text-left table-fixed dark:text-white">
      <thead>
        <tr className="border-gray-400 border-b-[1px] pointer-events-none">
          <th className="w-20 px-4 py-2"></th>
          <th className="w-48 px-4 py-2">Date</th>
          <th className="w-48 px-4 py-2">Status</th>
          <th className="px-4 py-2 min-w-[250px]">Details</th>
        </tr>
      </thead>
      <tbody>
        {submissionVersions.map((row) => {
          const viewing = row.id === viewingSubmissionVersionId;
          return (
            <tr key={row.id} className="border-b-[1px] border-gray-300 last:border-none">
              <td className="px-4 py-4 text-sm align-middle whitespace-nowrap">
                {viewing ? (
                  <ui.Badge variant="mono-dark">viewing</ui.Badge>
                ) : (
                  <Link to={`/app/works/${workId}/site/${siteName}/submission/${row.id}`}>
                    <ui.Badge
                      variant="outline"
                      className="transition-opacity cursor-pointer opacity-20 hover:opacity-100"
                    >
                      show
                    </ui.Badge>
                  </Link>
                )}
              </td>
              <td
                className={cn('px-4 py-4 text-sm align-middle whitespace-nowrap', {
                  'opacity-50': !viewing,
                  'font-medium': viewing,
                })}
              >
                <div>
                  {formatDate(new Date(row.date_created).toISOString(), ' h:mm a MMM d, yyyy')}
                </div>
              </td>
              <td
                className={cn('px-4 py-4 text-left align-middle', {
                  'opacity-50': !viewing,
                })}
              >
                <ui.SubmissionVersionBadge
                  submissionVersion={{
                    id: row.id,
                    status: row.status,
                    submission: {
                      id: row.submission.id,
                      collection: {
                        workflow: workflow.name,
                      },
                      site: {
                        name: row.submission.site.name,
                        title: row.submission.site.title,
                        metadata: row.submission.site.metadata,
                      },
                    },
                  }}
                  workflows={{ [workflow.name]: workflow }}
                  basePath="/app/works"
                  workVersionId={row.work_version?.work_id || ''}
                  showSite={false}
                  showLink={false}
                  variant="default"
                />
              </td>
              <td
                className={cn('px-4 py-4 text-left align-top', {
                  'opacity-50': !viewing,
                  'font-medium': viewing,
                })}
              >
                {/* Keep minimal details as per spec */}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
