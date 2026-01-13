import type { dbGetLinkedAccountsByUserId } from './db.server';
import { useFetcher } from 'react-router';
import type { GeneralError } from '@curvenote/scms-core';
import { ui } from '@curvenote/scms-core';
import React from 'react';

export function UnlinkAccount({
  account,
  onError,
}: {
  account: Awaited<ReturnType<typeof dbGetLinkedAccountsByUserId>>[number];
  onError: (slot: string, error?: GeneralError | string) => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean; error?: GeneralError }>();

  React.useEffect(() => {
    if (fetcher.data?.error) {
      onError(account.id, fetcher.data.error);
    }
  }, [fetcher.data, onError]);

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="provider" value={account.provider} />
      <input type="hidden" name="intent" value="unlink" />
      <ui.StatefulButton
        type="submit"
        variant="outline"
        size="sm"
        busy={fetcher.state !== 'idle'}
        overlayBusy
      >
        unlink
      </ui.StatefulButton>
    </fetcher.Form>
  );
}
