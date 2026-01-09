import { AuthComponentMap, primitives, ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import type { ClientSideSafeAuthOptions } from '@curvenote/scms-core';
import { useEffect, useState } from 'react';

export function LinkAccount({ options }: { options: ClientSideSafeAuthOptions }) {
  const fetcher = useFetcher();
  const [laggySubmitting, setLaggySubmitting] = useState(false);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      setLaggySubmitting(true);
      const to = setTimeout(() => {
        setLaggySubmitting(false);
      }, 2000);
      return () => clearTimeout(to);
    }
  }, [fetcher.state]);

  const Badge = AuthComponentMap[options.provider]?.Badge;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // don't prevent default, this is additional to the form submission
    await fetch('/app/settings/linked-accounts', {
      method: 'POST',
      body: new FormData(e.currentTarget),
    });
  };

  return (
    <primitives.Card key={`link-${options.provider}`} lift className="flex flex-col w-[260px]">
      <div className="flex items-center p-6 grow">
        <Badge showName className="scale-150" />
      </div>
      <div className="flex justify-end border-t-[1px] border-gray-200 pt-[10px] pb-[2px] text-sm items-center">
        <fetcher.Form method="POST" action={`/auth/${options.provider}`} onSubmit={handleSubmit}>
          <input type="hidden" name="provider" value={options.provider} />
          <input type="hidden" name="intent" value="link" />
          <ui.StatefulButton
            size="sm"
            variant="outline"
            type="submit"
            busy={fetcher.state !== 'idle' || laggySubmitting}
            busyMessage="Linking..."
          >
            Link Account
          </ui.StatefulButton>
        </fetcher.Form>
      </div>
    </primitives.Card>
  );
}
