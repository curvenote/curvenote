import { formatDate, ui, cn } from '@curvenote/scms-core';
import { Pencil, Trash2 } from 'lucide-react';
import type { TagCatalogRow } from './types.js';

type TagRowProps = {
  tag: TagCatalogRow;
  onEdit: (tag: TagCatalogRow) => void;
  onDelete: (tag: TagCatalogRow) => void;
};

const STICKY_START_CLASS = cn(
  'xs:sticky xs:left-0 xs:z-10 xs:bg-white xs:dark:bg-stone-900 xs:border-r xs:border-stone-200 xs:dark:border-stone-700 xs:group-hover:bg-stone-50 xs:dark:group-hover:bg-stone-800',
);
const STICKY_END_CLASS = cn(
  'xs:sticky xs:right-0 xs:z-10 xs:bg-white xs:dark:bg-stone-900 xs:border-l xs:border-stone-200 xs:dark:border-stone-700 xs:group-hover:bg-stone-50 xs:dark:group-hover:bg-stone-800',
);

export function TagRow({ tag, onEdit, onDelete }: TagRowProps) {
  const handleEdit = () => {
    onEdit(tag);
  };
  const handleDelete = () => {
    onDelete(tag);
  };

  return (
    <tr className="group hover:bg-stone-50 dark:hover:bg-stone-800/50">
      <td className={cn('px-4 py-3 whitespace-nowrap', STICKY_START_CLASS)}>
        <ui.Badge variant="neutral" size="xs" title={tag.name}>
          {tag.label}
        </ui.Badge>
      </td>
      <td className="px-4 py-3 font-mono text-sm text-stone-600 dark:text-stone-300 whitespace-nowrap">
        {tag.name}
      </td>
      <td className="px-4 py-3 text-sm text-stone-500 dark:text-stone-400 whitespace-nowrap">
        {formatDate(tag.date_created)}
      </td>
      <td className={cn('px-4 py-3 whitespace-nowrap min-w-24', STICKY_END_CLASS)}>
        <div className="flex items-center justify-end gap-2">
          <ui.Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={handleEdit}
            className="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
          >
            <Pencil className="w-4 h-4" />
            <span className="sr-only">Edit {tag.label}</span>
          </ui.Button>
          <ui.Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">Delete {tag.label}</span>
          </ui.Button>
        </div>
      </td>
    </tr>
  );
}
