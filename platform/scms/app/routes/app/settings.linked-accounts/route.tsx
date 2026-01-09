import type { Route } from './+types/route';
import { data } from 'react-router';
import { withAppContext, withValidFormData } from '@curvenote/scms-server';
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
} from '@curvenote/scms-core';
import {
  dbDeleteLinkedAccount,
  dbGetLinkedAccountsByUserId,
  dbUpsertPendingLinkedAccount,
} from './db.server';
import { LinkAccount } from './LinkAccount';
import type { GeneralError } from '@curvenote/scms-core';
import { useState } from 'react';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import { UnlinkAccount } from './UnlinkAccount';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  const accounts = await dbGetLinkedAccountsByUserId(ctx.user!.id);
  return { accounts, primaryProvider: ctx.user!.primaryProvider };
}

const LinkAccountSchema = zfd.formData({
  provider: zfd.text(z.string()),
  intent: zfd.text(z.enum(['link', 'unlink'])),
});

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppContext(args);
  return withValidFormData(
    LinkAccountSchema,
    await args.request.formData(),
    async ({ provider, intent }) => {
      const providerNames = Object.keys(ctx.$config.auth ?? {});
      if (!providerNames.includes(provider)) {
        return data({ error: { status: 400, message: 'Invalid provider' } }, { status: 400 });
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

        return { ok: true };
      }

      return data({ error: { status: 400, message: 'Invalid intent' } }, { status: 400 });
    },
    { errorFields: { type: 'general', intent: 'link-account' } },
  );
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Linked Accounts', branding.title) }];
};

export default function LinkedAccounts({ loaderData }: Route.ComponentProps) {
  const { authProviders } = useDeploymentConfig();
  const [errors, setErrors] = useState<Record<string, GeneralError | string>>({});
  const { accounts, primaryProvider } = loaderData;

  const linkedProviders = accounts.filter((a) => !a.pending);
  const linkedProviderNames = linkedProviders.map(({ provider }) => provider);
  const linkableOrPendingProviders = authProviders.filter(
    (item) => item.allowLinking && !linkedProviderNames.includes(item.provider),
  );
  const showDivider = linkedProviders.length > 0 && linkableOrPendingProviders.length > 0;

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
                className="flex flex-col w-full px-6 py-4 space-y-4"
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
        <div className="flex flex-wrap items-stretch gap-4 py-8">
          {linkableOrPendingProviders.map((item) => (
            <LinkAccount key={item.provider} options={item} />
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
