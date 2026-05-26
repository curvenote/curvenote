import { Link } from 'react-router';
import { formatDate, summarizeAuthors } from '@curvenote/scms-core';
import type { SubmissionsIndexItem } from './types.js';
import { DoiBadge } from './DoiBadge.js';

const AUTHORS_MAX_DISPLAY = 5;

interface SubmissionsListProps {
  siteName: string;
  items: SubmissionsIndexItem[];
}

export function SubmissionsList({ siteName, items }: SubmissionsListProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">No submissions found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl">
      <div className="overflow-hidden bg-white rounded-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        {items.map((item) => {
          const authorSummary = summarizeAuthors(item.authors, { maxDisplay: AUTHORS_MAX_DISPLAY });
          const fullAuthorList = item.authors.map((author) => author.name).join(', ');

          return (
            <div
              key={item.id}
              className="px-5 py-4 border-b border-gray-200 last:border-b-0 dark:border-gray-700"
            >
              <div className="flex flex-col gap-0 min-w-0">
                <Link
                  to={`/app/sites/${siteName}/submissions/${item.id}`}
                  className="text-base font-medium leading-snug text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {item.title || 'Untitled submission'}
                </Link>
                {authorSummary ? (
                  <p
                    className="text-sm font-light text-gray-600 dark:text-gray-400"
                    title={fullAuthorList}
                  >
                    {authorSummary}
                  </p>
                ) : (
                  <p className="text-sm italic font-light text-gray-600 dark:text-gray-400">
                    No authors listed
                  </p>
                )}
                <p className="text-sm font-light text-gray-600 dark:text-gray-400">
                  Publication Date: {item.datePublished ? formatDate(item.datePublished) : 'n/a'}
                </p>
                {item.doi ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <DoiBadge doi={item.doi} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
