import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { SiteRole } from '@curvenote/scms-db';
import type { GeneralError } from '@curvenote/scms-core';
import type { sites } from '@curvenote/scms-server';
import { withAppSiteContext, userHasSiteScopes, userHasSiteScope } from '@curvenote/scms-server';
import { UserIcon } from '@heroicons/react/24/outline';
import { User, UserPlus } from 'lucide-react';
import {
  PageFrame,
  site as siteScopes,
  UserCard,
  getBrandingFromMetaMatches,
  joinPageTitle,
  SectionWithHeading,
} from '@curvenote/scms-core';
import { dbGetSiteUsers, dtoSiteUsers } from './db.server.js';
import { SiteRolesForm } from './SiteRolesForm.js';
import {
  $actionGrantUserRole,
  $actionRevokeUserRole,
  ActionFormDataSchema,
  type ParsedFormData,
} from './actionHelpers.server.js';

interface LoaderData {
  users: Array<
    Omit<ReturnType<typeof dtoSiteUsers>[number], 'site_roles'> & {
      site_roles: { role: SiteRole; canRemove: boolean }[];
    }
  >;
  site: ReturnType<typeof sites.formatSiteDTO>;
  canUpdateRoles: boolean;
  canModifyAdminRoles: boolean;
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

  const canUpdateRoles = userHasSiteScopes(
    ctx.user,
    [siteScopes.users.update, siteScopes.users.delete],
    ctx.site.id,
  );
  const canModifyAdminRoles = canUpdateRoles && userHasSiteScope(ctx.user, siteScopes.users.admin);

  // Regular page load
  const dbo = await dbGetSiteUsers(ctx.site.name);
  if (!dbo) return { error: 'Failed to get site users' };
  const users = dtoSiteUsers(dbo);

  const usersWithScopedRoles = users.map((user) => ({
    ...user,
    site_roles: user.site_roles.map((role) => ({
      role,
      canRemove: role === SiteRole.ADMIN ? canModifyAdminRoles : canUpdateRoles,
    })),
  }));

  return {
    users: usersWithScopedRoles,
    site: ctx.siteDTO,
    canUpdateRoles,
    canModifyAdminRoles,
  };
}

export async function action(args: ActionFunctionArgs) {
  // redirect: false here without a catch and custom error handling, with return a hard 403, resulting in an error page
  // this desired UX as the UI controls should be disabled if the user does not have permission
  const ctx = await withAppSiteContext(args, [siteScopes.users.update, siteScopes.users.delete], {
    redirect: false,
  });

  const formData = await args.request.formData();

  // Validate form data including intent
  let validatedData;
  try {
    validatedData = ActionFormDataSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return data(
      {
        error: {
          type: 'general',
          message: error?.issues?.[0]?.message || 'Invalid form data',
        } as GeneralError,
      },
      { status: 422 },
    );
  }

  // Extract intent and payload (without intent)
  const { intent, ...payload } = validatedData;
  const rolePayload: ParsedFormData = payload;
  const { role: targetRole } = rolePayload;

  if (targetRole === SiteRole.ADMIN) {
    if (!userHasSiteScope(ctx.user, siteScopes.users.admin)) {
      return data(
        {
          error: {
            type: 'general',
            message: `You are not authorized to ${intent} admin permissions`,
          } as GeneralError,
        },
        { status: 403 },
      );
    }
  }

  // Route to appropriate action based on intent
  if (intent === 'grant') {
    return $actionGrantUserRole(ctx, rolePayload);
  } else if (intent === 'revoke') {
    return $actionRevokeUserRole(ctx, rolePayload);
  }

  // This should never happen due to Zod validation, but TypeScript needs it
  return data(
    { error: { type: 'general', message: 'Invalid intent' } as GeneralError },
    { status: 400 },
  );
}

export default function Users({ loaderData }: { loaderData: LoaderData }) {
  const { users, site, canUpdateRoles, canModifyAdminRoles } = loaderData;

  return (
    <PageFrame title="Users" subtitle={`Manage the users and access roles for ${site?.title}`}>
      {/* Add User Section */}

      {canUpdateRoles && (
        <SectionWithHeading heading="Grant Roles" icon={UserPlus}>
          <div className="p-6 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <SiteRolesForm canGrantAdminRole={canModifyAdminRoles} />
          </div>
        </SectionWithHeading>
      )}

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
