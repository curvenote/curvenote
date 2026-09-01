import { primitives, cn } from '@curvenote/scms-core';
import { getTagsTableColumnPin } from './tags.utils.js';

type TagsTableProps = {
  children: React.ReactNode;
  className?: string;
};

const HEADER_CELL_CLASS = cn(
  'px-4 py-2 text-sm font-medium text-left text-stone-500 whitespace-nowrap border-b border-stone-200 dark:border-stone-700',
);
const STICKY_START_CLASS = cn(
  'xs:sticky xs:left-0 xs:z-10 xs:bg-white xs:dark:bg-stone-900 xs:border-r xs:border-stone-200 xs:dark:border-stone-700',
);
const STICKY_END_CLASS = cn(
  'xs:sticky xs:right-0 xs:z-10 xs:bg-white xs:dark:bg-stone-900 xs:border-l xs:border-stone-200 xs:dark:border-stone-700',
);

export function TagsTable({ children, className }: TagsTableProps) {
  const labelPin = getTagsTableColumnPin('label');
  const namePin = getTagsTableColumnPin('name');
  const createdPin = getTagsTableColumnPin('created');
  const actionsPin = getTagsTableColumnPin('actions');

  return (
    <primitives.Card lift className={cn(className)}>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tags catalog">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                className={cn(
                  HEADER_CELL_CLASS,
                  labelPin === 'start' && STICKY_START_CLASS,
                  labelPin === 'end' && STICKY_END_CLASS,
                )}
              >
                Label
              </th>
              <th
                className={cn(
                  HEADER_CELL_CLASS,
                  namePin === 'start' && STICKY_START_CLASS,
                  namePin === 'end' && STICKY_END_CLASS,
                )}
              >
                Name
              </th>
              <th
                className={cn(
                  HEADER_CELL_CLASS,
                  createdPin === 'start' && STICKY_START_CLASS,
                  createdPin === 'end' && STICKY_END_CLASS,
                )}
              >
                Created
              </th>
              <th
                className={cn(
                  HEADER_CELL_CLASS,
                  'w-24 min-w-24 text-right',
                  actionsPin === 'start' && STICKY_START_CLASS,
                  actionsPin === 'end' && STICKY_END_CLASS,
                )}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:not(:last-child)>td]:border-b [&>tr:not(:last-child)>td]:border-stone-200 dark:[&>tr:not(:last-child)>td]:border-stone-700">
            {children}
          </tbody>
        </table>
      </div>
    </primitives.Card>
  );
}
