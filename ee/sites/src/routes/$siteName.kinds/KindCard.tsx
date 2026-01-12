import { Link, useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { MoreVertical, ShieldCheck, SquareCheckBig } from 'lucide-react';

// TODO: kind Type
export function KindCard({ kind }: { kind: any }) {
  const title = kind.content?.title ?? kind.name;
  const description = kind.content?.description ?? 'No description';
  const fetcher = useFetcher();
  return (
    <Link to={`${kind.name}`} tabIndex={0} aria-label={title} className="block focus:outline-none">
      <primitives.Card
        lift
        className="relative group cursor-pointer border rounded-md transition-colors"
        validateUsing={fetcher}
      >
        <div className="flex flex-col gap-2 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-semibold mb-3">{title}</div>
              <div className="text-sm mb-4">{description}</div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <ui.Menu>
                <ui.MenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-stone-100" aria-label="Open menu">
                    <MoreVertical className="w-5 h-5 text-stone-500" />
                  </button>
                </ui.MenuTrigger>
                <ui.MenuContent align="end">
                  <fetcher.Form method="post">
                    <input type="hidden" name="kindId" value={kind.id} />
                    <input type="hidden" name="intent" value="delete-kind" />
                    <ui.MenuItem
                      onClick={(e) => {
                        if (window.confirm('Are you sure you want to delete this kind?')) {
                          const formData = new FormData();
                          formData.append('intent', 'delete-kind');
                          formData.append('kindId', kind.id);
                          fetcher.submit(formData, { method: 'post' });
                        } else {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete Kind…
                    </ui.MenuItem>
                  </fetcher.Form>
                </ui.MenuContent>
              </ui.Menu>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {kind.checks.slice(0, 5).map((check: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm min-w-0">
                <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                <span className="truncate whitespace-nowrap overflow-ellipsis block">
                  {check.title}
                </span>
              </li>
            ))}
            {kind.checks.length > 5 && (
              <li className="flex items-center gap-2 text-sm min-w-0">
                <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                <span className="truncate whitespace-nowrap overflow-ellipsis block">
                  +{kind.checks.length - 5} more checks
                </span>
              </li>
            )}
          </ul>
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center text-sm text-green-500">
              {kind.default && (
                <>
                  <SquareCheckBig className="inline w-4 h-4 mr-1" />
                  <span>Default</span>
                </>
              )}
            </div>
            <span className="px-3 py-1 rounded-full border border-stone-400 dark:border-stone-200 text-xs font-mono">
              {kind.name}
            </span>
          </div>
        </div>
      </primitives.Card>
    </Link>
  );
}
