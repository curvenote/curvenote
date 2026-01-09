import { primitives, summarizeAuthors } from '@curvenote/scms-core';

export function WorkDetailsCard({
  title,
  authors,
  thumbnail,
  draft,
}: {
  title: string;
  authors?: any[];
  thumbnail?: string;
  draft?: boolean;
}) {
  const authorSummary = summarizeAuthors(authors ?? [], { maxDisplay: 2 }) || 'Unknown authors';
  return (
    <div className="p-2">
      <primitives.Card lift className="relative px-0 pt-0 space-y-2">
        {draft && (
          <div
            className="absolute top-0 right-0 text-xs text-gray-600 dark:text-gray-300"
            title="work date"
          >
            DRAFT
          </div>
        )}
        <primitives.Thumbnail
          className="w-full h-[120px] object-cover rounded-md"
          src={thumbnail}
          alt={title ?? ''}
        />
        <div className="px-4 space-y-2 text-left">
          <h3 className="font-light" title={title}>
            {title}
          </h3>
          <div className="text-xs text-gray-600 dark:text-gray-300" title="work authors">
            {authorSummary}
          </div>
        </div>
      </primitives.Card>
    </div>
  );
}
