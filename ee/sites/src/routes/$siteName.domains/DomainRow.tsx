import { format } from 'date-fns';
import { Star, Trash2 } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import type { Domain } from './db.server.js';
import { useFetcher } from 'react-router';

interface DomainRowProps {
  domain: Domain;
  canDelete: boolean;
}

export function DomainRow({ domain, canDelete }: DomainRowProps) {
  const setDefaultFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const isSettingDefault =
    setDefaultFetcher.state === 'submitting' &&
    setDefaultFetcher.formData?.get('domainId') === domain.id;
  const isDeleting =
    deleteFetcher.state === 'submitting' && deleteFetcher.formData?.get('domainId') === domain.id;

  const handleDelete = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (window.confirm(`Are you sure you want to delete the domain "${domain.hostname}"?`)) {
      const formData = new FormData(event.currentTarget);
      deleteFetcher.submit(formData, { method: 'post' });
    }
  };

  return (
    <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={`https://${domain.hostname}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-stone-900 dark:text-stone-100 hover:underline"
          >
            {domain.hostname}
          </a>
          {domain.default && (
            <ui.Badge variant="outline" className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              Primary
            </ui.Badge>
          )}
        </div>
        <div className="text-sm text-stone-500 dark:text-stone-400">
          Added {format(new Date(domain.date_created), 'MMM d, yyyy')}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {!domain.default && (
            <>
              <setDefaultFetcher.Form method="post">
                <input type="hidden" name="domainId" value={domain.id} />
                <input type="hidden" name="intent" value="set-default" />
                <ui.Button
                  variant="action"
                  size="icon-sm"
                  type="submit"
                  disabled={isSettingDefault}
                  className={cn(
                    'text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200',
                  )}
                >
                  <Star className="w-4 h-4" />
                  <span className="sr-only">Set as Primary</span>
                </ui.Button>
              </setDefaultFetcher.Form>
              {canDelete && (
                <deleteFetcher.Form method="post" onSubmit={handleDelete}>
                  <input type="hidden" name="domainId" value={domain.id} />
                  <input type="hidden" name="intent" value="delete" />
                  <ui.Button
                    variant="action"
                    size="icon-sm"
                    type="submit"
                    disabled={isDeleting}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Delete</span>
                  </ui.Button>
                </deleteFetcher.Form>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
