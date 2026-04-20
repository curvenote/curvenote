import type { Route } from './+types/route';
import { redirect, useFetcher } from 'react-router';
import { useState } from 'react';
import {
  createEmailVerificationToken,
  getEmailVerificationSigningKey,
  withAppContext,
  unsubscribe,
} from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  ui,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  getFetcherField,
  KnownResendEvents,
} from '@curvenote/scms-core';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const intent = formData.get('intent');
  if (intent === 'send-verification-email') {
    if (ctx.user.email_verified) {
      return { error: 'Email already verified' };
    }
    const jwtKey = getEmailVerificationSigningKey(ctx.$config.api?.resend?.apiKey);
    if (!jwtKey) {
      return { error: 'Email not configured' };
    }
    try {
      const token = createEmailVerificationToken(ctx.user.id, ctx.user.email, jwtKey);
      const verifyUrl = ctx.asBaseUrl(`/verify-email?token=${token}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[dev] Email verification link for ${ctx.user.email}: ${verifyUrl}`);
      }
      await ctx.sendEmail({
        eventType: KnownResendEvents.EMAIL_VERIFICATION,
        to: ctx.user.email,
        subject: 'Verify your email',
        ignoreUnsubscribe: true,
        templateProps: { verifyUrl },
      });
      return { verifySuccess: true, verifyMessage: 'Verification email sent. Check your inbox.' };
    } catch (error) {
      console.error('Send verification email error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to send verification email',
      };
    }
  }

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
  const verifyFetcher = useFetcher<typeof action>();
  const [checked, setChecked] = useState(isUnsubscribed);
  const verifySuccess = getFetcherField(verifyFetcher.data, 'verifySuccess');
  const verifyMessage = getFetcherField(verifyFetcher.data, 'verifyMessage');
  const verifyError = getFetcherField(verifyFetcher.data, 'error');

  if (!user) return null;

  return (
    <PageFrame title="Email Preferences" subtitle="Manage your email notification preferences">
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Email Address</h2>
        <p>
          The email registered when your account was created and will be used for account-related
          notifications.
        </p>
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
          <ui.Input
            className="max-w-sm disabled:opacity-80"
            disabled
            value={user.email ?? 'none set'}
          />
          {user.email_verified ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Email verified
            </span>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-0.5 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                Email unverified
              </span>
              <verifyFetcher.Form method="post">
                <input type="hidden" name="intent" value="send-verification-email" />
                <ui.Button
                  type="submit"
                  disabled={verifyFetcher.state === 'submitting' || !!verifySuccess}
                  className="whitespace-nowrap"
                >
                  {verifyFetcher.state === 'submitting'
                    ? 'Sending…'
                    : verifySuccess
                      ? 'Verification email sent'
                      : 'Resend verification email'}
                </ui.Button>
              </verifyFetcher.Form>
            </div>
          )}
        </div>
        {verifySuccess && verifyMessage && (
          <p className="text-sm text-green-600 dark:text-green-400">{verifyMessage}</p>
        )}
        {verifyError && <p className="text-sm text-red-600 dark:text-red-400">{verifyError}</p>}
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
