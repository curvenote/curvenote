import type { Route } from './+types/route';
import { data, useSearchParams, useFetcher } from 'react-router';
import {
  withAppContext,
  withValidFormData,
  dbUpsertPendingLinkedAccount,
} from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  ui,
  cn,
  formatDatetime,
  formatToNow,
  AuthComponentMap,
  useDeploymentConfig,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  useHydrated,
  formatAuthProviderDisplayName,
} from '@curvenote/scms-core';
import { dbDeleteLinkedAccount, dbGetLinkedAccountsByUserId } from './db.server';
import { LinkAccount } from './LinkAccount';
import type { GeneralError } from '@curvenote/scms-core';
import { useState, useEffect, useRef } from 'react';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import { UnlinkAccount } from './UnlinkAccount';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  const accounts = await dbGetLinkedAccountsByUserId(ctx.user!.id);
  const url = new URL(args.request.url);
  const linked = url.searchParams.get('linked');
  const linkError = url.searchParams.get('error');
  const provider = url.searchParams.get('provider');
  const message = url.searchParams.get('message');
  const linkToast = linked
    ? { type: 'success' as const, provider: linked }
    : linkError
      ? {
          type: 'error' as const,
          message:
            message ?? `Could not link${provider ? ` ${provider}` : ''} account. Please try again.`,
          provider: provider ?? undefined,
        }
      : undefined;
  return { accounts, primaryProvider: ctx.user!.primaryProvider, linkToast };
}

const LinkAccountSchema = zfd.formData({
  provider: zfd.text(z.string()),
  intent: zfd.text(z.enum(['link', 'unlink'])),
});

const LinkResultSchema = zfd.formData({
  intent: zfd.text(z.literal('link-result')),
  provider: zfd.text(z.string()),
  kind: zfd.text(z.enum(['success', 'error'])).optional(),
  message: zfd.text(z.string()).optional(),
});

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppContext(args);
  const formData = await args.request.formData();

  const formIntent = formData.get('intent');
  if (formIntent === 'link-result') {
    return withValidFormData(LinkResultSchema, formData, async ({ provider, kind, message }) => {
      if (kind === 'error') {
        return {
          error: { status: 400, message: message ?? 'Could not link account.' },
          provider,
        };
      }
      return { ok: true, provider };
    });
  }

  return withValidFormData(
    LinkAccountSchema,
    formData,
    async ({ provider, intent }) => {
      const providerNames = Object.keys(ctx.$config.auth ?? {});
      if (!providerNames.includes(provider)) {
        return data(
          { error: { status: 400, message: 'Invalid provider' }, provider },
          { status: 400 },
        );
      }

      if (intent === 'link') {
        const account = await dbUpsertPendingLinkedAccount(ctx.user!.id, provider);

        await ctx.trackEvent(TrackEvent.USER_LINKED, {
          provider,
        });

        await ctx.analytics.flush();

        return { account };
      } else if (intent === 'unlink') {
        await dbDeleteLinkedAccount(ctx.user.id, provider);

        await ctx.trackEvent(TrackEvent.USER_UNLINKED, {
          provider,
        });

        await ctx.analytics.flush();

        return { ok: true, provider };
      }

      return data({ error: { status: 400, message: 'Invalid intent' }, provider }, { status: 400 });
    },
    { errorFields: { type: 'general', intent: 'link-account' } },
  );
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Linked Accounts', branding.title) }];
};

function getFetcherErrorMessage(error: GeneralError | string | undefined): string {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) return error.message;
  return 'An unknown error occurred';
}

export default function LinkedAccounts({ loaderData }: Route.ComponentProps) {
  const { authProviders } = useDeploymentConfig();
  const [errors, setErrors] = useState<Record<string, GeneralError | string>>({});
  const [, setSearchParams] = useSearchParams();
  const isHydrated = useHydrated();
  const { accounts, primaryProvider, linkToast } = loaderData;
  const unlinkFetcher = useFetcher<{
    ok?: boolean;
    provider?: string;
    error?: GeneralError | string;
  }>();
  const linkFetcher = useFetcher<{
    ok?: boolean;
    provider?: string;
    error?: GeneralError | string;
  }>();
  const lastUnlinkToastKey = useRef<string | null>(null);
  const lastLinkToastKey = useRef<string | null>(null);
  const linkToastSubmitted = useRef<string | null>(null);
  const [pendingUnlinkProvider, setPendingUnlinkProvider] = useState<string | null>(null);

  const linkedProviders = accounts.filter((a) => !a.pending);
  const linkedProviderNames = linkedProviders.map(({ provider }) => provider);
  const linkableOrPendingProviders = authProviders.filter(
    (item) => item.allowLinking && !linkedProviderNames.includes(item.provider),
  );
  const showDivider = linkedProviders.length > 0 && linkableOrPendingProviders.length > 0;

  // Unlink toasts: keep fetcher in this route so it survives revalidation/unmounting cards.
  useEffect(() => {
    if (!isHydrated) return;
    if (unlinkFetcher.state !== 'idle' || !unlinkFetcher.data) return;
    const result = unlinkFetcher.data;
    const toastKey = JSON.stringify({
      ok: result.ok,
      provider: result.provider,
      error: typeof result.error === 'string' ? result.error : result.error?.message,
    });
    if (toastKey === lastUnlinkToastKey.current) return;
    lastUnlinkToastKey.current = toastKey;

    if (result.ok && result.provider) {
      ui.toastSuccess(
        `${formatAuthProviderDisplayName(result.provider, authProviders)} account unlinked`,
      );
    } else if (result.error) {
      ui.toastError(getFetcherErrorMessage(result.error));
    }
  }, [unlinkFetcher.state, unlinkFetcher.data, isHydrated, authProviders]);

  useEffect(() => {
    if (unlinkFetcher.state === 'idle') setPendingUnlinkProvider(null);
  }, [unlinkFetcher.state]);

  // Feed OAuth redirect result into linkFetcher so we can use the same toast pattern as unlink.
  useEffect(() => {
    if (!linkToast || linkToastSubmitted.current !== null) return;
    const key = JSON.stringify(linkToast);
    linkToastSubmitted.current = key;
    const payload = new FormData();
    payload.set('intent', 'link-result');
    payload.set('provider', linkToast.provider ?? '');
    payload.set('kind', linkToast.type);
    if (linkToast.type === 'error' && linkToast.message) {
      payload.set('message', linkToast.message);
    }
    linkFetcher.submit(payload, { method: 'post' });
    setSearchParams({}, { replace: true });
  }, [linkToast, linkFetcher, setSearchParams]);

  // Link toasts: same pattern as unlink — show when linkFetcher is idle with data.
  useEffect(() => {
    if (!isHydrated) return;
    if (linkFetcher.state !== 'idle' || !linkFetcher.data) return;
    const result = linkFetcher.data;
    const toastKey = JSON.stringify({
      ok: result.ok,
      provider: result.provider,
      error: typeof result.error === 'string' ? result.error : result.error?.message,
    });
    if (toastKey === lastLinkToastKey.current) return;
    lastLinkToastKey.current = toastKey;

    if (result.ok && result.provider) {
      ui.toastSuccess(
        `${formatAuthProviderDisplayName(result.provider, authProviders)} account linked successfully`,
      );
    } else if (result.error) {
      ui.toastError(getFetcherErrorMessage(result.error));
    }
  }, [linkFetcher.state, linkFetcher.data, isHydrated, authProviders]);

  return (
    <PageFrame
      title="Linked Accounts"
      subtitle="Manage your linked accounts"
      description="Linked accounts allow you to sign in to your account using an external provider."
    >
      <div className={cn({ 'divide-y divide-stone-200 dark:divide-stone-600': showDivider })}>
        {accounts.length === 0 && linkableOrPendingProviders.length === 0 && (
          <primitives.Card lift className="flex flex-col p-8 space-y-4">
            <h2>No linked accounts</h2>
            <p>You have not linked any accounts to your profile.</p>
          </primitives.Card>
        )}
        <div className="grid grid-cols-1 gap-4 pb-8 max-w-max md:grid-cols-2">
          {linkedProviders.map((account) => {
            const ProfileCard = AuthComponentMap[account.provider]?.ProfileCardContent;
            return (
              <primitives.Card
                key={account.id + account.provider}
                lift
                className="flex flex-col px-6 py-4 space-y-4 w-full"
              >
                <ProfileCard profile={account.profile}>
                  <div>
                    <div
                      className={cn(
                        'flex items-center pt-4 mt-4 space-x-2 text-sm border-t border-stone-200 dark:border-stone-600',
                        {
                          'mt-5': account.provider === primaryProvider,
                        },
                      )}
                      title={account.date_linked ? formatDatetime(account.date_linked) : ''}
                    >
                      <div>
                        Account linked{' '}
                        {account.date_linked
                          ? formatToNow(account.date_linked, { addSuffix: true })
                          : ''}
                      </div>
                      {account.provider === primaryProvider && (
                        <div title="primary provider h-12">
                          <div className="px-[4px] py-[1px] text-xs bg-blue-100 text-blue-600 dark:text-inherit border border-blue-600 rounded dark:border-stone-200  dark:bg-stone-600">
                            primary
                          </div>
                        </div>
                      )}
                      {account.provider !== primaryProvider && (
                        <div className="ml-auto">
                          <UnlinkAccount
                            account={account}
                            fetcher={unlinkFetcher}
                            busy={
                              unlinkFetcher.state !== 'idle' &&
                              pendingUnlinkProvider === account.provider
                            }
                            onSubmit={() => {
                              setPendingUnlinkProvider(account.provider);
                              setErrors((prev) => {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const { [account.id]: _, ...rest } = prev;
                                return rest;
                              });
                            }}
                            onError={(slot, error) => {
                              if (!error) {
                                setErrors((prev) => {
                                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                  const { [slot]: _, ...rest } = prev;
                                  return rest;
                                });
                              } else {
                                setErrors((prev) => ({ ...prev, [slot]: error }));
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {errors[account.id] && <ui.ErrorMessage error={errors[account.id]} />}
                </ProfileCard>
              </primitives.Card>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 items-stretch py-8">
          {linkableOrPendingProviders.map((item) => (
            <LinkAccount key={item.provider} options={item} />
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
