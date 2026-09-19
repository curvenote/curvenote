import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { CROSSREF_MEMBERSHIP_URL } from './doi.utils.js';
import type { DoiActionData } from './doi.utils.js';
import { normalizePrefix } from '../../backend/crossref/prefix.js';
import { RegistrationMethodPicker } from './RegistrationMethodPicker.js';

type DoiSetupProps = {
  siteTitle: string;
  customPrefixEnabled: boolean;
};

/**
 * First-time setup. A site with the own-prefix flag registers under its own prefix by default,
 * so it goes straight to the prefix form; every other site picks Curvenote-managed registration.
 */
export function DoiSetup({ siteTitle, customPrefixEnabled }: DoiSetupProps) {
  const fetcher = useFetcher<DoiActionData>();
  const busy = fetcher.state !== 'idle';
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error);
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);

  if (!customPrefixEnabled) {
    const onContinue = () => {
      fetcher.submit({ intent: 'configure-curvenote' }, { method: 'POST' });
    };
    return (
      <ui.Card className="px-6 py-4 space-y-4">
        <ui.Badge variant="outline-muted">Not configured</ui.Badge>
        <h2>Set up DOI registration</h2>
        <p className="text-sm font-light">
          Choose how this Site will register DOIs for published Works.
        </p>
        <RegistrationMethodPicker siteTitle={siteTitle} />
        <div className="flex justify-end">
          <ui.StatefulButton type="button" onClick={onContinue} busy={busy} overlayBusy>
            Continue
          </ui.StatefulButton>
        </div>
      </ui.Card>
    );
  }

  return (
    <ui.Card className="px-6 py-4 space-y-4">
      <ui.Badge variant="outline-muted">Not configured</ui.Badge>
      <h2>Connect your organization&apos;s Crossref account</h2>
      <p className="text-sm font-light">
        Register DOIs using {siteTitle}&apos;s own prefix and Crossref account.
      </p>
      <fetcher.Form method="POST" className="m-0 space-y-4">
        <input type="hidden" name="intent" value="configure-custom" />
        <div className="space-y-2">
          <label htmlFor="doi-setup-prefix" className="block text-sm font-medium">
            DOI prefix
          </label>
          <ui.Input
            id="doi-setup-prefix"
            name="prefix"
            className="max-w-sm font-mono"
            placeholder="e.g. 10.1234 or 1234"
            onBlur={(e) => {
              e.currentTarget.value =
                normalizePrefix(e.currentTarget.value) ?? e.currentTarget.value;
            }}
            disabled={busy}
            required
          />
          <p className="text-xs text-muted-foreground">
            The DOI prefix assigned to your organization by Crossref.
          </p>
        </div>
        <div className="p-4 space-y-1 text-sm border rounded-sm border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800">
          <p className="font-medium">Don&apos;t have a Crossref account?</p>
          <p className="font-light">
            Your organization must become a Crossref member to receive its own DOI prefix and
            account credentials.
          </p>
          <a
            className="inline-block underline"
            href={CROSSREF_MEMBERSHIP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Crossref&apos;s member setup guide
          </a>
        </div>
        <div className="flex justify-end">
          <ui.StatefulButton type="submit" busy={busy} overlayBusy>
            Continue
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </ui.Card>
  );
}
