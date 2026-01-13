import type { Route } from './+types/route';
import { withAppPlatformAdminContext } from '@curvenote/scms-server';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle } from '@curvenote/scms-core';
import { data, Link } from 'react-router';
import { dbCountSystemUsers, dbGetSystemUsers, dbUpdateUserSystemRole } from './db.server';
import { SystemUserList } from './SystemUserList';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const [total, items] = await Promise.all([dbCountSystemUsers(), dbGetSystemUsers()]);
  return {
    scopes: ctx.scopes,
    total,
    items,
    currentUserId: ctx.user.id,
  };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;
  const userId = formData.get('userId') as string;

  try {
    switch (intent) {
      case 'updateSystemRole': {
        const systemRole = formData.get('systemRole') as string;

        // Prevent users from changing their own system role
        if (userId === ctx.user.id) {
          return data({ error: 'You cannot change your own system role' }, { status: 400 });
        }

        const updatedUser = await dbUpdateUserSystemRole(userId, systemRole);
        return { success: true, user: updatedUser };
      }
      default: {
        return data({ error: 'Invalid intent' }, { status: 400 });
      }
    }
  } catch (error: any) {
    console.log('error', error);
    return data({ error: error.message }, { status: 500 });
  }
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('System Users', 'System Administration', branding.title) }];
};

export default function SystemUsers({ loaderData }: Route.ComponentProps) {
  const { total, items, currentUserId } = loaderData;

  return (
    <PageFrame
      title="Users"
      description={
        <span>
          Use this page to manage users' system roles, use the{' '}
          <Link to="/app/platform/users">platform/users</Link> screen for all other functions.
        </span>
      }
    >
      <div className="mb-4 font-light text-left text-gray-600 dark:text-gray-400">
        Total Users: {total}
      </div>

      <SystemUserList users={items} currentUserId={currentUserId} />
    </PageFrame>
  );
}
