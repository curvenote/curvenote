import type { Route } from './+types/route';
import { withAppContext } from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  ui,
  useDeploymentConfig,
  AuthComponentMap,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { Link } from 'react-router';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  return { user: ctx.user };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('My Account', branding.title) }];
};

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const { branding } = useDeploymentConfig();
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
          <Link
            to="/app/settings/emails"
            className="text-sm text-blue-600 whitespace-nowrap hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Manage email preferences →
          </Link>
        </div>
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
