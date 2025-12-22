import { Link, useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { MoreVertical, LockOpen, Lock, SquareCheckBig, Shapes, Files } from 'lucide-react';
import { plural } from 'myst-common';

export function CollectionCard({ collection, siteName }: { collection: any; siteName: string }) {
  const title = collection.content?.title ?? collection.name;
  const description = collection.content?.description ?? 'No description';
  const submissionsUrl = `/app/sites/${siteName}/submissions?page=1&perPage=30&collection=${collection.name}`;
  const fetcher = useFetcher();
  const submissionsCount = collection._count.submissions;

  return (
    <primitives.Card
      lift
      className="relative transition-colors border rounded-md group"
      validateUsing={fetcher}
    >
      <div className="flex flex-col gap-2 p-5">
        <Link
          to={`${collection.name}`}
          tabIndex={0}
          aria-label={title}
          className="block focus:outline-none"
        >
          <div className="flex items-start justify-between cursor-pointer">
            <div>
              <div className="mb-3 text-2xl font-semibold">{title}</div>
              <div className="mb-4 text-sm">{description}</div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <ui.Menu>
                <ui.MenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-stone-100" aria-label="Open menu">
                    <MoreVertical className="w-5 h-5 text-stone-500" />
                  </button>
                </ui.MenuTrigger>
                <ui.MenuContent align="end" className="min-w-[200px]">
                  <fetcher.Form method="post">
                    <input type="hidden" name="collectionId" value={collection.id} />
                    <input type="hidden" name="intent" value="delete-collection" />
                    <ui.MenuItem
                      disabled={!!submissionsCount}
                      onClick={(e) => {
                        if (
                          submissionsCount ||
                          !window.confirm('Are you sure you want to delete this collection?')
                        ) {
                          e.preventDefault();
                        } else {
                          const formData = new FormData();
                          formData.append('intent', 'delete-collection');
                          formData.append('collectionId', collection.id);
                          fetcher.submit(formData, { method: 'post' });
                        }
                      }}
                      className={submissionsCount ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      Delete Collection…
                    </ui.MenuItem>
                  </fetcher.Form>
                </ui.MenuContent>
              </ui.Menu>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {collection.kindsInCollection && collection.kindsInCollection.length > 0 ? (
              <span>
                <Shapes className="inline w-4 h-4 mr-1 text-blue-500" />
                {collection.kindsInCollection.map((kic: any, i: number) => (
                  <span key={i}>
                    {kic.kind.content?.title ?? kic.kind.name}
                    {i < collection.kindsInCollection.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-gray-500">
                <Shapes className="inline w-4 h-4 mr-1 text-gray-400" />
                No kinds defined
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 pr-2">
              <div className="flex items-center text-sm">
                {collection.open ? (
                  <span className="flex items-center text-green-500">
                    <LockOpen className="inline w-4 h-4 mr-1" />
                    <span>Open</span>
                  </span>
                ) : (
                  <span className="flex items-center text-red-500">
                    <Lock className="inline w-4 h-4 mr-1" />
                    <span>Closed</span>
                  </span>
                )}
              </div>
              <div className="flex items-center text-sm text-green-500">
                {collection.default && (
                  <>
                    <SquareCheckBig className="inline w-4 h-4 mr-1" />
                    <span>Default</span>
                  </>
                )}
              </div>
            </div>
            <span className="px-3 py-1 font-mono text-xs border rounded-full border-stone-400 dark:border-stone-200">
              {collection.name}
            </span>
          </div>
        </Link>
        <div className="mt-4">
          {submissionsCount ? (
            <Link
              to={submissionsUrl}
              className="inline-flex items-center justify-center w-full gap-2 px-3 py-2 text-xs font-medium text-blue-700 border border-blue-200 rounded bg-blue-50 hover:bg-blue-100"
              tabIndex={0}
              aria-label={`View submissions for ${title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Files className="w-4 h-4" />
              {`View ${plural('%s submission(s)', submissionsCount)}`}
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center w-full gap-2 px-3 py-2 text-xs font-medium rounded bg-stone-100 text-stone-400">
              <Files className="w-4 h-4" />
              No submissions
            </div>
          )}
        </div>
      </div>
    </primitives.Card>
  );
}
