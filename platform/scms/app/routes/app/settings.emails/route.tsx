import type { Route } from './+types/route';
import { redirect, useFetcher } from 'react-router';
import { useState } from 'react';
import { withAppContext, unsubscribe } from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  ui,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
} from '@curvenote/scms-core';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  if (!ctx.user.email) {
    throw redirect('/app/settings/account');
  }
  const unsubscribedEmail = await unsubscribe.dbGetUnsubscribedEmail(ctx.user.email);
  return { user: ctx.user, isUnsubscribed: !!unsubscribedEmail };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppContext(args);
  if (!ctx.user.email) {
    throw redirect('/app/settings/account');
  }

  const formData = await args.request.formData();
  const unsubscribeFlag = formData.get('unsubscribe') === 'on';

  await unsubscribe.dbToggleUnsubscribe(ctx.user.email, unsubscribeFlag);

  await ctx.trackEvent(TrackEvent.USER_EMAIL_PREFERENCES_UPDATED, {
    unsubscribe: unsubscribeFlag,
  });

  await ctx.analytics.flush();

  return { success: true };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Email Preferences', branding.title) }];
};

export default function EmailPreferences({ loaderData }: Route.ComponentProps) {
  const { user, isUnsubscribed } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [checked, setChecked] = useState(isUnsubscribed);

  if (!user) return null;

  return (
    <PageFrame title="Email Preferences" subtitle="Manage your email notification preferences">
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Email Address</h2>
        <p>
          The email registered when your account was created and will be used for account-related
          notifications.
        </p>
        <ui.Input
          className="max-w-sm disabled:opacity-80"
          disabled
          value={user.email ?? 'none set'}
        />
      </primitives.Card>
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Notification Emails</h2>
        <fetcher.Form method="post" className="space-y-4">
          <div className="flex items-start space-x-3">
            <ui.Checkbox
              id="unsubscribe"
              name="unsubscribe"
              checked={checked}
              onCheckedChange={(value) => {
                setChecked(!!value);
                const formData = new FormData();
                formData.append('unsubscribe', value ? 'on' : 'off');
                fetcher.submit(formData, { method: 'post' });
              }}
            />
            <div className="space-y-2">
              <label
                htmlFor="unsubscribe"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Unsubscribe from notification emails
              </label>
              <p className="text-sm text-muted-foreground">
                You will still receive emails for changing password, account verification, and other
                essential account-related communications.
              </p>
            </div>
          </div>
        </fetcher.Form>
      </primitives.Card>
    </PageFrame>
  );
}
