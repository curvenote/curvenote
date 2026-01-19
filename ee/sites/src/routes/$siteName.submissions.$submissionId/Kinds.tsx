import { useFetcher } from 'react-router';
import { SquarePen, SquareCheckBig, Replace } from 'lucide-react';
import classNames from 'classnames';
import type { sites } from '@curvenote/scms-server';
import { primitives, cn } from '@curvenote/scms-core';
import { useRef } from 'react';

export function Kinds({
  submissionId,
  collection,
  kindId,
  kindNameOrTitle,
  canUpdate,
}: {
  submissionId: string;
  collection: Awaited<ReturnType<typeof sites.collections.list>>['items'][0];
  kindId: string;
  kindNameOrTitle: string;
  canUpdate: boolean;
}) {
  const fetcher = useFetcher<{ error?: string; kindId: string; kindName: string }>();
  const popoverRef = useRef<primitives.PopoverActions>(null);
  const submissionKindMatch = collection?.kinds?.some((k) => k.id === kindId);
  const current = collection?.kinds.find((k) => k.id === kindId);

  function handleSetKind(
    e: React.FormEvent<HTMLFormElement>,
    newKindId: string,
    nameOrTitle: string,
  ) {
    e.preventDefault();
    e.stopPropagation();

    if (confirm(`Change the kind of this submission to "${nameOrTitle}"?`) === false) return;

    fetcher.submit(
      {
        submission_id: submissionId,
        collection_id: collection.id,
        kind_id: newKindId,
        name_or_title: nameOrTitle,
        formAction: 'set-kind',
      },
      { method: 'POST' },
    );

    popoverRef.current?.closePopover();
  }

  // optimistic ui
  const kindTitle =
    (fetcher.formData?.get('name_or_title') as string) ??
    current?.content?.title ??
    current?.name ??
    kindNameOrTitle;

  const cardContent = (
    <div className="text-md">
      <table className="w-full">
        <thead>
          <tr className="border-b-[1px] border-gray-500 bg-gray-100">
            <th className="px-3 py-1 text-left">name</th>
            <th className="px-3 py-1 text-center">in use</th>
            <th className="px-3 py-1 text-center align-text-bottom" title="set as primary">
              <SquareCheckBig className="inline-block w-4 h-4" />
            </th>
          </tr>
        </thead>
        <tbody>
          {collection?.kinds.map((k) => (
            <tr key={k.id} className="even:bg-gray-50">
              <td className="px-3 py-1 text-left" title={k.id}>
                {k.name}
              </td>
              <td className="px-3 py-1 text-center">
                {k.id === kindId ? (
                  <SquareCheckBig className="inline-block w-4 h-4 stroke-green-600" />
                ) : (
                  ''
                )}
              </td>
              <td className="px-3 py-1 text-center">
                <fetcher.Form onSubmit={(e) => handleSetKind(e, k.id, k.content?.title ?? k.name)}>
                  <button
                    className={classNames('align-text-bottom', {
                      'cursor-pointer': k.id !== kindId,
                    })}
                    type="submit"
                    title="set as primary"
                  >
                    <Replace
                      className={classNames('inline-block w-4 h-4', {
                        'stroke-gray-300': k.id === kindId,
                        'cursor-pointer': k.id !== kindId,
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
      className={cn('z-20 p-6 pb-4 min-w-[310px]')}
      content={cardContent}
    >
      <div className="flex flex-col items-right">
        <div
          className={cn('text-right underline cursor-pointer', {
            'font-semibold text-red-500': !submissionKindMatch,
          })}
          title={kindId}
        >
          {kindTitle ?? current?.name}
          {canUpdate && <SquarePen className="inline-block w-4 h-4 ml-[2px] mb-[2px]" />}
        </div>
        {fetcher.data?.error && <div className="text-xs text-red-600">{fetcher.data.error}</div>}
      </div>
    </primitives.PopoverWrapper>
  );
}
