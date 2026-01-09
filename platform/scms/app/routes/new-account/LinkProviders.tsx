import { useFetcher, useLoaderData } from 'react-router';
import type { ActionResponse, LoaderData } from './types';
import { TaskListStep } from './TaskListStep';
import { ui, useDeploymentConfig, google, okta, orcid, cn } from '@curvenote/scms-core';
import { useEffect, useState } from 'react';
import type { LinkProvidersStepData, UserData } from '@curvenote/scms-core';
import type { AlternativePrompt } from '@/types/app-config';
import { CheckCircle } from 'lucide-react';

export function LinkAccountDuringSignupButton({
  provider,
  badge,
  submitting,
  setSubmitting,
  disabled,
  className,
}: {
  provider: string;
  badge: React.ReactNode;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const fetcher = useFetcher<ActionResponse>();

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      setSubmitting(true);
    } else setSubmitting(false);
  }, [fetcher.state]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // don't prevent default, this is additional to the form submission
    await fetch('/new-account/pending', {
      method: 'POST',
      body: new FormData(e.currentTarget),
    });
  };
  return (
    <fetcher.Form
      method="post"
      action={`/auth/${provider}`}
      onSubmit={handleSubmit}
      className={className}
    >
      <input type="hidden" name="intent" value="update-link-providers" />
      <input type="hidden" name="linkingProvider" value={provider} />
      <ui.StatefulButton
        variant="outline"
        type="submit"
        disabled={fetcher.state !== 'idle' || submitting || disabled}
        busy={fetcher.state !== 'idle' || submitting}
        overlayBusy
        className="w-full"
      >
        <div className="flex items-center justify-center w-full gap-2">{badge} Link Account</div>
      </ui.StatefulButton>
    </fetcher.Form>
  );
}

export function LinkProvidersStep({
  title,
  providers,
  open,
  setOpen,
}: {
  title?: string;
  providers: string[];
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) {
  const { user } = useLoaderData() as LoaderData;
  const { authProviders, signupConfig } = useDeploymentConfig();
  const linkableAuthProviders = authProviders.filter((p) => p.allowLinking);
  const linkableAuthProviderNames = linkableAuthProviders.map((p) => p.provider);

  let providersToShow = providers
    .filter((p) =>
      linkableAuthProviderNames.includes(p as 'firebase' | 'google' | 'okta' | 'orcid'),
    )
    .filter((provider) => provider !== user.primaryProvider);

  // HACK: handle firebase / google name collision
  if (providersToShow.some((p) => p === 'firebase') && user.primaryProvider === 'google') {
    providersToShow = providersToShow.filter((p) => p !== 'firebase');
  }

  const [submitting, setSubmitting] = useState(false);
  const fetcher = useFetcher<ActionResponse>();

  const userData = (user.data ?? {}) as UserData;
  const signupData = userData.signup ?? {};
  const stepData = signupData.steps?.['link-providers'] as LinkProvidersStepData;
  const skipped = stepData?.skippedByUser ?? false;

  const linkedAccounts = user.linkedAccounts;
  const linkedProviderNames = linkedAccounts
    .filter((account) => account.pending === false)
    .map((account) => account.provider);

  const noProvidersToShow = providersToShow.length === 0;
  const allProvidersLinked = providersToShow.every((provider) =>
    linkedProviderNames.includes(provider),
  );

  const alternativePrompts =
    signupConfig?.signup?.steps?.find((step) => step.type === 'link-providers')
      ?.alternativePrompts ?? [];

  const promptsToShow = alternativePrompts.filter(({ provider }: AlternativePrompt) =>
    providersToShow.includes(provider),
  );

  return (
    <TaskListStep
      completed={allProvidersLinked && !skipped && !noProvidersToShow}
      skipped={skipped || noProvidersToShow}
      title={title ?? 'Link additional accounts'}
      open={open}
      setOpen={setOpen}
    >
      <input type="hidden" name="intent" value="complete-link-providers" />
      <div className="space-y-2">
        <div>
          {promptsToShow.length > 0 && (
            <div className={cn('mb-2', { 'opacity-50': skipped || allProvidersLinked })}>
              {promptsToShow.map((p) => p.text).join('.')}.
            </div>
          )}
          {!noProvidersToShow && (
            <div className={cn({ 'opacity-50': skipped || allProvidersLinked })}>
              Please link your accounts:
            </div>
          )}
          {!noProvidersToShow && (
            <div className="flex flex-col items-center w-full my-8 space-y-2">
              {providersToShow.map((provider) => (
                <div
                  key={provider}
                  className="flex flex-wrap justify-center w-full max-w-xs gap-x-1 gap-y-2"
                >
                  {provider === 'firebase' && linkedProviderNames.includes('firebase') && (
                    <div className="flex items-center w-full">
                      <CheckCircle className="w-6 h-6" /> <google.Badge /> is linked
                    </div>
                  )}
                  {provider === 'firebase' && !linkedProviderNames.includes('firebase') && (
                    <LinkAccountDuringSignupButton
                      provider={provider}
                      badge={<google.Badge />}
                      disabled={submitting || skipped}
                      submitting={submitting}
                      setSubmitting={setSubmitting}
                      className={cn('w-full', { 'pointer-not-allowed': skipped })}
                    />
                  )}
                  {provider === 'google' && linkedProviderNames.includes('google') && (
                    <div>
                      <CheckCircle className="w-6 h-6" /> <google.Badge /> is linked
                    </div>
                  )}
                  {provider === 'google' && !linkedProviderNames.includes('google') && (
                    <LinkAccountDuringSignupButton
                      provider={provider}
                      badge={<google.Badge />}
                      disabled={submitting || skipped}
                      submitting={submitting}
                      setSubmitting={setSubmitting}
                      className={cn('w-full', { 'pointer-not-allowed': skipped })}
                    />
                  )}
                  {provider === 'okta' && linkedProviderNames.includes('okta') && (
                    <div className="flex items-center w-full gap-2">
                      <CheckCircle className="w-5 h-5 stroke-green-700 fill-green-50" />
                      <okta.Badge showName /> OKTA
                      <div className="pb-[2px] opacity-50">successfully linked</div>
                    </div>
                  )}
                  {provider === 'okta' && !linkedProviderNames.includes('okta') && (
                    <LinkAccountDuringSignupButton
                      provider={provider}
                      badge={<okta.Badge showName />}
                      disabled={submitting || skipped}
                      submitting={submitting}
                      setSubmitting={setSubmitting}
                      className={cn('w-full', { 'pointer-not-allowed': skipped })}
                    />
                  )}
                  {provider === 'orcid' && linkedProviderNames.includes('orcid') && (
                    <div className="flex items-center w-full gap-2">
                      <CheckCircle className="w-5 h-5 stroke-green-700 fill-green-50" />
                      <orcid.Badge />
                      <div className="pb-[2px] opacity-50">successfully linked</div>
                    </div>
                  )}
                  {provider === 'orcid' && !linkedProviderNames.includes('orcid') && (
                    <LinkAccountDuringSignupButton
                      provider={provider}
                      badge={<orcid.Badge />}
                      disabled={submitting || skipped}
                      submitting={submitting}
                      setSubmitting={setSubmitting}
                      className={cn('w-full', { 'pointer-not-allowed': skipped })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {allProvidersLinked && !skipped && !noProvidersToShow && (
          <div className="text-sm text-muted-foreground">
            All required providers have been linked.
          </div>
        )}
        {noProvidersToShow && !skipped && (
          <div className="text-sm text-muted-foreground">No providers available to link.</div>
        )}
        {skipped && (
          <div className="text-sm text-muted-foreground">Linking providers has been skipped.</div>
        )}
        {!allProvidersLinked && !skipped && !noProvidersToShow && (
          <fetcher.Form method="post" className="">
            <input type="hidden" name="intent" value="skip-link-providers" />
            <ui.Button variant="link" type="submit">
              Skip for now
            </ui.Button>
          </fetcher.Form>
        )}
        {!allProvidersLinked && skipped && !noProvidersToShow && (
          <fetcher.Form method="post" className="">
            <input type="hidden" name="intent" value="unskip-link-providers" />
            <ui.Button variant="link" type="submit">
              Resume linking
            </ui.Button>
          </fetcher.Form>
        )}
      </div>
    </TaskListStep>
  );
}
