import React from 'react';
import { formatDate } from '../utils/formatDate.js';

export interface SubmissionVersionTableRow {
  id: string;
  date_created: string;
  [key: string]: any;
}

type RenderTitleFn<T> = (row: T) => React.ReactNode;

interface Props<T extends SubmissionVersionTableRow> {
  submissionVersions: T[];
  renderTitle?: RenderTitleFn<T>;
}

export function SubmissionVersionsTable<T extends SubmissionVersionTableRow>({
  submissionVersions,
  renderTitle,
}: Props<T>) {
  return (
    <table className="w-full text-left table-fixed dark:text-white">
      <thead>
        <tr className="border-gray-400 border-b-[1px] pointer-events-none">
          <th className="w-32 px-4 py-2">Date</th>
          <th className="px-4 py-2 min-w-[250px]">Title</th>
        </tr>
      </thead>
      <tbody>
        {submissionVersions.map((row) => (
          <tr key={row.id} className="border-b-[1px] border-gray-300 last:border-none">
            <td className="px-4 py-2 align-top whitespace-nowrap">
              {formatDate(row.date_created)}
            </td>
            <td className="px-4 py-2 text-left align-top">
              {renderTitle ? renderTitle(row) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
