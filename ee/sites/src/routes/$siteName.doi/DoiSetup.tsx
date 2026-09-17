import { useState } from 'react';
import { useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { CROSSREF_MEMBERSHIP_URL } from './doi.utils.js';
import type { DoiActionData } from './doi.utils.js';
import { EnterpriseDialog } from './EnterpriseDialog.js';
import { RegistrationMethodPicker } from './RegistrationMethodPicker.js';
import type { RegistrationMethod } from './RegistrationMethodPicker.js';

type Step = 'intro' | 'choose' | 'custom-form';

type DoiSetupProps = {
  siteTitle: string;
  customPrefixEnabled: boolean;
};

export function DoiSetup({ siteTitle, customPrefixEnabled }: DoiSetupProps) {
  const fetcher = useFetcher<DoiActionData>();
  const [step, setStep] = useState<Step>('intro');
  const [method, setMethod] = useState<RegistrationMethod>('curvenote');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const busy = fetcher.state !== 'idle';

  if (step === 'intro') {
    return (
      <primitives.Card lift className="px-6 py-4 space-y-3">
        <ui.Badge variant="outline-muted">Not configured</ui.Badge>
        <h2>Set up DOI registration</h2>
        <p className="text-sm font-light">
          Connect this Site to a DOI registration service before registering DOIs for published
          content.
        </p>
        <ui.Button onClick={() => setStep('choose')}>Set up DOI</ui.Button>
      </primitives.Card>
    );
  }

  if (step === 'choose') {
    const onContinue = () => {
      if (method === 'custom') {
        setStep('custom-form');
        return;
      }
      fetcher.submit({ intent: 'configure-curvenote' }, { method: 'POST' });
    };
    return (
      <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
        <h2>How would you like to register DOIs?</h2>
        <p className="text-sm font-light">
          Choose how DOIs are registered for published Works on this Site.
        </p>
        <RegistrationMethodPicker
          value={method}
          onChange={setMethod}
          customPrefixEnabled={customPrefixEnabled}
          siteTitle={siteTitle}
          onUpgrade={() => setUpgradeOpen(true)}
        />
        <div className="flex justify-end">
          <ui.StatefulButton type="button" onClick={onContinue} busy={busy} overlayBusy>
            Continue
          </ui.StatefulButton>
        </div>
        <EnterpriseDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} siteTitle={siteTitle} />
      </primitives.Card>
    );
  }

  return (
    <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
      <h2>Connect your organization&apos;s Crossref prefix</h2>
      <p className="text-sm font-light">
        Register DOIs using {siteTitle}&apos;s own prefix. You only enter the prefix; Curvenote
        links the Crossref role once your organisation grants access.
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
            placeholder="e.g. 10.1234"
            disabled={busy}
            required
          />
          <p className="text-xs text-muted-foreground">
            The DOI prefix assigned to your organization by Crossref.
          </p>
        </div>
        <ui.SimpleAlert
          type="neutral"
          size="compact"
          message={
            <>
              <span className="font-medium">Don&apos;t have a Crossref account?</span> Your
              organization must become a Crossref member to receive its own DOI prefix.{' '}
              <a
                className="underline"
                href={CROSSREF_MEMBERSHIP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Crossref&apos;s member setup guide
              </a>
            </>
          }
        />
        <div className="flex justify-between">
          <ui.Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setStep('choose')}
          >
            Back
          </ui.Button>
          <ui.StatefulButton type="submit" busy={busy} overlayBusy>
            Continue
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </primitives.Card>
  );
}
