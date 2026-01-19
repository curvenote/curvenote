import { useFetcher } from 'react-router';
import { Replace, SquarePen, SquareCheckBig } from 'lucide-react';
import classNames from 'classnames';
import type { sites } from '@curvenote/scms-server';
import { primitives } from '@curvenote/scms-core';
import type { Prisma } from '@curvenote/scms-db';
import { useRef } from 'react';

export function Collections({
  submissionId,
  collectionId,
  collections,
  canUpdate,
}: {
  submissionId: string;
  collectionId: string;
  collections: Awaited<ReturnType<typeof sites.collections.list>>['items'];
  canUpdate: boolean;
}) {
  const fetcher = useFetcher<{ error?: string }>();
  const popoverRef = useRef<primitives.PopoverActions>(null);
  const current = collections.find((c) => c.id === collectionId);

  function handleSetCollection(
    e: React.FormEvent<HTMLFormElement>,
    newCollectionId: string,
    nameOrTitle: string,
  ) {
    e.preventDefault();
    e.stopPropagation();

    if (confirm(`Change the collection of this submission to "${nameOrTitle}"?`) === false) return;

    fetcher.submit(
      {
        submission_id: submissionId,
        collection_id: newCollectionId,
        name_or_title: nameOrTitle,
        formAction: 'set-collection',
      },
      { method: 'POST' },
    );

    popoverRef.current?.closePopover();
  }

  // optimistic ui
  const collectionTitle =
    (fetcher.formData?.get('name_or_title') as string) ??
    current?.content?.title ??
    current?.name ??
    'Unknown';
  const collectionName = current?.content?.name;

  const cardContent = (
    <div className="text-md">
      <table className="w-full">
        <thead>
          <tr className="border-b-[1px] border-gray-500 bg-gray-100">
            <th className="px-3 py-1 text-left">title</th>
            <th className="px-3 py-1 text-left">name</th>
            <th className="px-3 py-1 text-center">in use</th>
            <th className="px-3 py-1 text-center align-text-bottom" title="set as primary">
              <SquareCheckBig className="inline-block w-4 h-4" />
            </th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.id} className="even:bg-gray-50">
              <td className="px-3 py-1 text-left" title={c.id}>
                {c.content?.title && c.name ? `${c.content?.title} (${c?.name})` : '-'}
              </td>
              <td className="px-3 py-1 text-left" title={c.id}>
                {c.name}
              </td>
              <td className="px-3 py-1 text-center">
                {c.id === collectionId ? (
                  <SquareCheckBig className="inline-block w-4 h-4 stroke-green-600" />
                ) : (
                  ''
                )}
              </td>
              <td className="px-3 py-1 text-center">
                <fetcher.Form
                  onSubmit={(e) => handleSetCollection(e, c.id, c.content?.title ?? c.name)}
                >
                  <button
                    className={classNames('align-text-bottom', {
                      'cursor-pointer': c.id !== collectionId,
                    })}
                    type="submit"
                    title="set as primary"
                  >
                    <Replace
                      className={classNames('inline-block w-4 h-4', {
                        'stroke-gray-300': c.id === collectionId,
                        'cursor-pointer': c.id !== collectionId,
                      })}
                    />
                  </button>
                </fetcher.Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <primitives.PopoverWrapper
      ref={popoverRef}
      className="min-w-[310px] z-20 p-6 pb-4"
      content={cardContent}
    >
      <div className="flex flex-col items-right">
        <div
          className="text-right underline cursor-pointer"
          title={`${current?.name ?? 'unknown'} ${current?.id ?? ''}`}
        >
          {collectionTitle ?? collectionName ?? 'unknown'}
          {canUpdate && <SquarePen className="inline-block w-4 h-4 ml-[2px] mb-[2px]" />}
        </div>
        {fetcher.data?.error && <div className="text-xs text-red-600">{fetcher.data.error}</div>}
      </div>
    </primitives.PopoverWrapper>
  );
}
