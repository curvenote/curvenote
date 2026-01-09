import { SquareCheckBig, SquarePen, LockOpen, Lock, Trash2 } from 'lucide-react';
import classNames from 'classnames';
import { SlugLike } from '@curvenote/scms-core';
import type { CollectionsDBO } from './db.server.js';

export function CollectionListItem({
  c,
  deletingId,
  editingId,
  idle,
  handleStartEdit,
  handleDelete,
}: {
  c: CollectionsDBO[0];
  deletingId: string | null;
  editingId: string | null;
  idle: boolean;
  handleStartEdit?: (c: CollectionsDBO[0]) => void;
  handleDelete?: (c: CollectionsDBO[0]) => void;
}) {
  const subCollections = Array.isArray(c.childCollections)
    ? (c.childCollections as Array<{ id: string; slug: string }>)
    : [];
  const itemKinds = Array.isArray(c.kindsInCollection)
    ? (c.kindsInCollection as Array<{ kind: { id: string; name: string } }>).map((i) => i.kind)
    : [];
  const { title, description } = c.content as any;
  return (
    <tr
      className={classNames('space-x-4 border-b-[1px] border-gray-300 last:border-none', {
        'opacity-50 line-through': deletingId === c.id,
      })}
    >
      <td className="px-4 py-2 text-center">
        <div className="flex justify-end space-x-2">
          {c.default ? <SquareCheckBig className="inline w-4 h-4 stroke-green-500" /> : ''}
          {c.open ? (
            <LockOpen className="inline w-4 h-4 stroke-green-500" />
          ) : (
            <Lock className="inline w-4 h-4 stroke-red-500" />
          )}
        </div>
      </td>
      <td className="px-4 py-2 font-mono text-sm pointer-events-none whitespace-nowrap">
        {c.name}
      </td>
      <td className="px-4 py-2 pointer-events-none whitespace-nowrap">
        {c.slug.length === 0 ? <SlugLike>{'/'}</SlugLike> : <SlugLike>{`/${c.slug}`}</SlugLike>}
      </td>
      <td className="px-4 py-2 pointer-events-none">{c.workflow}</td>
      <td className="px-4 py-2 text-left ">
        <div className="text-lg font-semibold">{title ?? 'no title'}</div>
        <div>
          {description ?? (
            <span className="font-light text-gray-400 dark:text-gray-500">no description</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 pointer-events-none">
        {itemKinds.length > 0 ? (
          <span className="font-mono text-xs text-red-900">
            {itemKinds.map((k) => k.name).join(' · ')}
          </span>
        ) : (
          '-'
        )}
      </td>
      <td
        className="px-4 py-2 cursor-default"
        title={`there are currently ${c._count.submissions} submission(s) in this collection`}
      >
        {c._count.submissions}
      </td>
      <td className="px-4 py-2 text-center pointer-events-none">
        {c.parentCollection ? <SlugLike>{c.parentCollection.slug}</SlugLike> : '-'}
      </td>
      <td className="px-4 py-2 space-x-1 text-center pointer-events-none">
        {subCollections.length > 0
          ? subCollections.map((s) => <SlugLike key={`${c.id}-${s.slug}`}>{s.slug}</SlugLike>)
          : '-'}
      </td>
      {handleStartEdit && (
        <td className="py-2 pl-4 underline" title="edit">
          <SquarePen
            className={classNames('w-4 h-4', {
              'stroke-gray-300 cursor-not-allowed': editingId === c.id,
              'cursor-pointer': editingId !== c.id,
            })}
            onClick={() => handleStartEdit(c)}
          />
        </td>
      )}
      {handleDelete && (
        <td className="py-2 pl-1 pr-4 underline" title="delete (empty collections only)">
          <Trash2
            className={classNames('w-4 h-4 ', {
              'stroke-gray-300 cursor-not-allowed':
                c._count.submissions !== 0 || !idle || !handleDelete,
              'cursor-pointer': c._count.submissions === 0 && idle && !!handleDelete,
            })}
            onClick={() => handleDelete(c)}
          />
        </td>
      )}
    </tr>
  );
}
