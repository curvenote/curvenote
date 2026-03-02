import type { dbGetLinkedAccountsByUserId } from './db.server';
import type { FetcherWithComponents } from 'react-router';
import type { GeneralError } from '@curvenote/scms-core';
import { ui } from '@curvenote/scms-core';
import React from 'react';

export function UnlinkAccount({
  account,
  onError,
  fetcher,
  busy,
  onSubmit,
}: {
  account: Awaited<ReturnType<typeof dbGetLinkedAccountsByUserId>>[number];
  onError: (slot: string, error?: GeneralError | string) => void;
  fetcher: FetcherWithComponents<{
    ok?: boolean;
    provider?: string;
    error?: GeneralError | string;
  }>;
  busy: boolean;
  onSubmit?: () => void;
}) {
  React.useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    if (fetcher.data.provider !== account.provider) return;
    if (fetcher.data.error) onError(account.id, fetcher.data.error);
    else onError(account.id, undefined);
  }, [fetcher.state, fetcher.data, account.id, account.provider, onError]);

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="provider" value={account.provider} />
      <input type="hidden" name="intent" value="unlink" />
      <ui.StatefulButton
        type="submit"
        variant="outline"
        size="sm"
        busy={busy}
        overlayBusy
        onClick={() => onSubmit?.()}
      >
        Unlink
      </ui.StatefulButton>
    </fetcher.Form>
  );
}
