import { primitives, cn } from '@curvenote/scms-core';

type TagsTableProps = {
  children: React.ReactNode;
  className?: string;
};

export function TagsTable({ children, className }: TagsTableProps) {
  return (
    <primitives.Card lift className={cn(className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-200 dark:border-stone-700">
            <th className="px-4 py-2 text-sm font-medium text-left text-stone-500">Label</th>
            <th className="px-4 py-2 text-sm font-medium text-left text-stone-500">Name</th>
            <th className="px-4 py-2 text-sm font-medium text-left text-stone-500">Created</th>
            <th className="w-24 px-4 py-2 text-sm font-medium text-right text-stone-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200 dark:divide-stone-700">{children}</tbody>
      </table>
    </primitives.Card>
  );
}
