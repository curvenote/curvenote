import { useFetcher } from 'react-router';
import { useCallback } from 'react';
import type { action } from './actionHelpers.server';
import { formatDistanceToNow } from 'date-fns';
import { formatDate, ui } from '@curvenote/scms-core';
import type { dtoUserToken } from './db.server';

export function UserToken({
  token,
  onDelete,
}: {
  token: ReturnType<typeof dtoUserToken>;
  onDelete: (id: string) => void;
}) {
  const { id, description, date_expires, expired, last_used } = token;
  const fetcher = useFetcher<typeof action>();

  const handleDelete = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = {
      formAction: 'delete',
      tokenId: id,
    };
    if (expired) {
      fetcher.submit(formData, { method: 'POST' });
      onDelete(id);
    } else if (confirm(`Are you sure you want to delete "${description}" token?`)) {
      fetcher.submit(formData, { method: 'POST' });
      onDelete(id);
    }
  }, []);

  return (
    <li>
      <fetcher.Form className="py-4" method="POST" onSubmit={handleDelete}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="m-0 pointer-events-none">{description}</h3>

            <p
              className="text-sm pointer-events-auto"
              title={date_expires ? formatDate(date_expires, 'HH:mm:ss MMM dd, y') : undefined}
            >
              <span>
                {expired && date_expires && (
                  <span className="font-medium text-red-400 ">
                    Expired: {formatDate(date_expires)}
                  </span>
                )}
                {!expired && date_expires && (
                  <span className="">Expires: {formatDate(date_expires)}</span>
                )}
                {!expired && !date_expires && <span className="">Never expires</span>}
              </span>
              <span className="inline-block mx-1 font-bold">·</span>
              <span className="pointer-events-none ">
                {last_used
                  ? `Last used: ${formatDistanceToNow(new Date(last_used))}`
                  : 'never used'}
              </span>
            </p>
            <p className="text-sm">Created: {formatDate(token.date_created)}</p>
          </div>
          <div className="flex flex-col space-y-1 items-right">
            <ui.StatefulButton
              className="block opacity-100"
              type="submit"
              variant="outline"
              busy={fetcher.state === 'submitting'}
              busyMessage="Deleting..."
            >
              Delete
            </ui.StatefulButton>
          </div>
        </div>
      </fetcher.Form>
    </li>
  );
}
