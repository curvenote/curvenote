import type { Route } from './+types/route';
import { useFetcher, Link, data } from 'react-router';
import { withAppContext } from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  ui,
  useDeploymentConfig,
  AuthComponentMap,
  getBrandingFromMetaMatches,
  joinPageTitle,
  getFetcherField,
} from '@curvenote/scms-core';
import { KnownResendEvents } from '@curvenote/scms-core';
import { createEmailVerificationToken } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  return { user: ctx.user };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppContext(args);
  if (!ctx.user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }
  const intent = (await args.request.formData()).get('intent');
  if (intent === 'send-verification-email') {
    if (!ctx.user.email) {
      return data({ error: 'No email address on account' }, { status: 400 });
    }
    if (ctx.user.email_verified) {
      return data({ error: 'Email already verified' }, { status: 400 });
    }
    const jwtKey = ctx.$config.api?.resend?.apiKey;
    if (!jwtKey) {
      return data({ error: 'Email not configured' }, { status: 500 });
    }
    try {
      const token = createEmailVerificationToken(ctx.user.id, ctx.user.email, jwtKey);
      const verifyUrl = ctx.asBaseUrl(`/verify-email?token=${token}`);
      await ctx.sendEmail({
        eventType: KnownResendEvents.EMAIL_VERIFICATION,
        to: ctx.user.email,
        subject: 'Verify your email',
        ignoreUnsubscribe: true,
        templateProps: { verifyUrl },
      });
      return { success: true, message: 'Verification email sent. Check your inbox.' };
    } catch (error) {
      console.error('Send verification email error:', error);
      return data(
        { error: error instanceof Error ? error.message : 'Failed to send verification email' },
        { status: 500 },
      );
    }
  }
  return data({ error: 'Invalid action' }, { status: 400 });
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('My Account', branding.title) }];
};

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const { branding } = useDeploymentConfig();
  const verifyFetcher = useFetcher<typeof action>();
  const verifySuccess = getFetcherField(verifyFetcher.data, 'success');
  const verifyMessage = getFetcherField(verifyFetcher.data, 'message');
  const verifyError = getFetcherField(verifyFetcher.data, 'error');
  if (!user) return null;

  const Badge = user.primaryProvider ? AuthComponentMap[user.primaryProvider]?.Badge : null;

  return (
    <PageFrame title="Account" subtitle="Manage your account details">
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Display Name</h2>
        <p>Please enter your full name, or a display name you are comfortable with.</p>
        <ui.Input
          className="max-w-sm disabled:opacity-80"
          disabled
          value={user.display_name ?? '<none-set>'}
        />
      </primitives.Card>
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Username</h2>
        <p>This is your username within the {branding?.title ?? 'platform'}.</p>
        <ui.Input
          className="max-w-sm disabled:opacity-80"
          disabled
          value={user.username ?? '<none-set>'}
        />
      </primitives.Card>
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Email</h2>
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
          {user.email && (
            <>
              {user.email_verified ? (
                <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Verified
                </span>
              ) : (
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
                        ? 'Email sent'
                        : 'Send verification email'}
                  </ui.Button>
                </verifyFetcher.Form>
              )}
            </>
          )}
          <Link
            to="/app/settings/emails"
            className="text-sm text-blue-600 whitespace-nowrap hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Manage email preferences →
          </Link>
        </div>
        {verifySuccess && verifyMessage && (
          <p className="text-sm text-green-600 dark:text-green-400">{verifyMessage}</p>
        )}
        {verifyError && (
          <p className="text-sm text-red-600 dark:text-red-400">{verifyError}</p>
        )}
      </primitives.Card>
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Account ID</h2>
        <p>Your unique account identifer.</p>
        <ui.Input className="max-w-sm disabled:opacity-80" disabled value={user.id} />
      </primitives.Card>
      <primitives.Card lift className="flex flex-col p-8 space-y-4">
        <h2>Primary Auth Provider</h2>
        <p>Your primary login method.</p>
        <div>
          {user.primaryProvider == null && <div className="opacity-80">None set.</div>}
          {user.primaryProvider && (
            <Link to="/app/settings/linked-accounts" className="cursor-pointer">
              <div className="flex items-center p-1 px-2 space-x-4 border border-gray-200 rounded-lg shadow-xs w-max">
                {Badge && <Badge showName />}
                {!Badge && <div className="first-letter:uppercase">{user.primaryProvider}</div>}
              </div>
            </Link>
          )}
        </div>
      </primitives.Card>
    </PageFrame>
  );
}
