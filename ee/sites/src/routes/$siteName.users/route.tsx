import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import type { GeneralError } from '@curvenote/scms-core';
import type { sites } from '@curvenote/scms-server';
import { withAppSiteContext, userHasScope, assertUserDefined } from '@curvenote/scms-server';
import { UserIcon } from '@heroicons/react/24/outline';
import { User, UserPlus } from 'lucide-react';
import {
  PageFrame,
  site as siteScopes,
  UserCard,
  getBrandingFromMetaMatches,
  joinPageTitle,
  SectionWithHeading,
  scopes,
} from '@curvenote/scms-core';
import { dbGetSiteUsers, dtoSiteUsers } from './db.server.js';
import { SiteRolesForm } from './SiteRolesForm.js';
import { actionGrantUserRole, actionRevokeUserRole } from './actionHelpers.server.js';

interface LoaderData {
  users: ReturnType<typeof dtoSiteUsers>;
  site: ReturnType<typeof sites.formatSiteDTO>;
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    { title: joinPageTitle('Site Users', (loaderData as LoaderData)?.site?.title, branding.title) },
  ];
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData | { error: string }> {
  const ctx = await withAppSiteContext(args, [siteScopes.users.list], {
    redirectTo: '/app',
    redirect: true,
  });

  // Regular page load
  const dbo = await dbGetSiteUsers(ctx.site.name);
  if (!dbo) return { error: 'Failed to get site users' };
  const users = dtoSiteUsers(dbo);
  return { users, site: ctx.siteDTO };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.users.update, siteScopes.users.delete]);

  const formData = await args.request.formData();
  const intent = formData.get('intent');

  if (typeof intent !== 'string' || intent.length === 0) {
    return data(
      { error: { type: 'general', message: 'Intent not set' } as GeneralError },
      { status: 400 },
    );
  }

  // For grant/revoke actions, require additional permissions
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, scopes.site.users.update, ctx.site.name)) {
    return data(
      {
        error: {
          type: 'general',
          message: 'Unauthorized: current user cannot update user roles',
        } as GeneralError,
      },
      { status: 401 },
    );
  }

  if (intent === 'grant') {
    return actionGrantUserRole(ctx, formData);
  } else if (intent === 'revoke') {
    return actionRevokeUserRole(ctx, formData);
  }

  return data(
    { error: { type: 'general', message: 'Invalid intent' } as GeneralError },
    { status: 400 },
  );
}

export default function Users({ loaderData }: { loaderData: LoaderData }) {
  const { users, site } = loaderData;

  return (
    <PageFrame title="Users" subtitle={`Manage the users and access roles for ${site?.title}`}>
      {/* Add User Section */}

      <SectionWithHeading heading="Add User" icon={UserPlus}>
        <div className="p-6 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <SiteRolesForm />
        </div>
      </SectionWithHeading>

      {/* Current Users Section */}
      <SectionWithHeading heading="Current Users" icon={User}>
        <div className="overflow-hidden rounded-sm border bg-background">
          {users?.length === 0 ? (
            <div className="py-8 text-center">
              <UserIcon className="mx-auto w-12 h-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by adding a user above.
              </p>
            </div>
          ) : (
            users?.map((user) => (
              <UserCard
                key={user.id}
                name={user.display_name || 'Unknown User'}
                email={user.email}
                roles={user.site_roles}
                userId={user.id}
              />
            ))
          )}
        </div>
      </SectionWithHeading>
    </PageFrame>
  );
}
