import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  ShouldRevalidateFunctionArgs,
} from 'react-router';
import { data } from 'react-router';
import { useState } from 'react';
import { SiteRole } from '@curvenote/scms-db';
import type { GeneralError } from '@curvenote/scms-core';
import type { sites } from '@curvenote/scms-server';
import {
  withAppSiteContext,
  userHasSiteScopes,
  userHasSiteScope,
  validateFormData,
  createUserToken,
} from '@curvenote/scms-server';
import { UserIcon } from '@heroicons/react/24/outline';
import { User, UserPlus } from 'lucide-react';
import {
  PageFrame,
  site as siteScopes,
  ui,
  UserCard,
  getBrandingFromMetaMatches,
  joinPageTitle,
  SectionWithHeading,
} from '@curvenote/scms-core';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { dbGetSiteUsers, dtoSiteUsers } from './db.server.js';
import { SiteRolesForm } from './SiteRolesForm.js';
import {
  $actionGrantUserRole,
  $actionRevokeUserRole,
  ActionFormDataSchema,
  type ParsedFormData,
} from './actionHelpers.server.js';
import {
  dbCreateSiteServiceAccount,
  dbCreateTokenForUser,
  dbDeleteSiteServiceAccount,
  dbDeleteTokenForUser,
  dbGetSiteServiceAccount,
  dbListTokensForUser,
  formatDefaultServiceAccountDisplayName,
} from './serviceAccount.server.js';
import type {
  ServiceAccountData,
  ServiceAccountPermissions,
  ServiceAccountRole,
  ServiceAccountTokenDTO,
} from './ServiceAccountForm.js';
import { ServiceAccountForm } from './ServiceAccountForm.js';

interface LoaderData {
  users: Array<
    Omit<ReturnType<typeof dtoSiteUsers>[number], 'site_roles'> & {
      site_roles: { role: SiteRole; canRemove: boolean }[];
    }
  >;
  site: ReturnType<typeof sites.formatSiteDTO>;
  canUpdateRoles: boolean;
  canModifyAdminRoles: boolean;
  canViewServiceAccount: boolean;
  serviceAccount: ServiceAccountData | null;
  serviceAccountPermissions: ServiceAccountPermissions;
  defaultServiceAccountName: string;
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    { title: joinPageTitle('Site Users', (loaderData as LoaderData)?.site?.title, branding.title) },
  ];
};

function dtoUserToken(dbo: {
  id: string;
  description: string;
  date_created: string;
  date_expires: string | null;
  date_last_used: string | null;
}): ServiceAccountTokenDTO {
  const expired = dbo.date_expires ? new Date() > new Date(dbo.date_expires) : false;
  return {
    id: dbo.id,
    description: dbo.description,
    date_created: dbo.date_created,
    date_expires: dbo.date_expires,
    last_used: dbo.date_last_used,
    expired,
  };
}

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
  const canModifyAdminRoles =
    canUpdateRoles && userHasSiteScope(ctx.user, siteScopes.users.admin, ctx.site.id);

  // Service-account capabilities. `list` gates section visibility, `read`
  // gates pulling the underlying account/token data, and the remaining flags
  // gate per-action UI affordances. The action handlers also enforce these
  // scopes server-side.
  const canListServiceAccount = userHasSiteScope(
    ctx.user,
    siteScopes.serviceAccount.list,
    ctx.site.id,
  );
  const canReadServiceAccount = userHasSiteScope(
    ctx.user,
    siteScopes.serviceAccount.read,
    ctx.site.id,
  );
  const canCreateServiceAccount = userHasSiteScope(
    ctx.user,
    siteScopes.serviceAccount.create,
    ctx.site.id,
  );
  const canDeleteServiceAccount = userHasSiteScope(
    ctx.user,
    siteScopes.serviceAccount.delete,
    ctx.site.id,
  );
  const canCreateServiceTokens = userHasSiteScope(
    ctx.user,
    siteScopes.serviceAccount.tokens.create,
    ctx.site.id,
  );
  const canDeleteServiceTokens = userHasSiteScope(
    ctx.user,
    siteScopes.serviceAccount.tokens.delete,
    ctx.site.id,
  );

  // Regular page load
  const dbo = await dbGetSiteUsers(ctx.site.name);
  if (!dbo) return { error: 'Failed to get site users' };
  const users = dtoSiteUsers(dbo);

  const usersWithScopedRoles = users.map((user) => ({
    ...user,
    site_roles: user.site_roles.map((role) => ({
      role,
      canRemove:
        user.id === ctx.user.id
          ? false
          : role === SiteRole.ADMIN
            ? canModifyAdminRoles
            : canUpdateRoles,
    })),
  }));

  let serviceAccount: ServiceAccountData | null = null;
  if (canReadServiceAccount) {
    const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
    const tokensDBO = serviceUser ? await dbListTokensForUser(serviceUser.id) : [];
    serviceAccount = {
      user: serviceUser
        ? {
            id: serviceUser.id,
            display_name: serviceUser.display_name,
            role: (serviceUser.site_roles[0]?.role ?? null) as ServiceAccountRole | null,
          }
        : null,
      tokens: tokensDBO.map((t) => dtoUserToken(t)),
    };
  }

  return {
    users: usersWithScopedRoles,
    site: ctx.siteDTO,
    canUpdateRoles,
    canModifyAdminRoles,
    canViewServiceAccount: canListServiceAccount,
    serviceAccount,
    serviceAccountPermissions: {
      canRead: canReadServiceAccount,
      canCreate: canCreateServiceAccount,
      canDelete: canDeleteServiceAccount,
      canCreateTokens: canCreateServiceTokens,
      canDeleteTokens: canDeleteServiceTokens,
    },
    defaultServiceAccountName: formatDefaultServiceAccountDisplayName(ctx.site.title),
  };
}

const SERVICE_ACCOUNT_ACTIONS = [
  'create-service-account',
  'delete-service-account',
  'create-service-token',
  'delete-service-token',
] as const;

type ServiceAccountAction = (typeof SERVICE_ACCOUNT_ACTIONS)[number];

function isServiceAccountAction(value: unknown): value is ServiceAccountAction {
  return (
    typeof value === 'string' && SERVICE_ACCOUNT_ACTIONS.includes(value as ServiceAccountAction)
  );
}

const ServiceAccountCreateSchema = zfd.formData({
  formAction: z.literal('create-service-account'),
  // Only ADMIN or SUBMITTER are valid roles for a service account.
  role: zfd.text(z.union([z.literal('ADMIN'), z.literal('SUBMITTER')])),
});

const ServiceTokenCreateSchema = zfd.formData({
  formAction: z.literal('create-service-token'),
  description: zfd.text(z.string().trim()),
  expiry: zfd.text(
    z.union([
      z.literal('NEVER'),
      z.literal('FIVE_MINUTES'),
      z.literal('ONE_DAY'),
      z.literal('SEVEN_DAYS'),
      z.literal('THIRTY_DAYS'),
      z.literal('SIXTY_DAYS'),
      z.literal('NINETY_DAYS'),
      z.literal('ONE_YEAR'),
    ]),
  ),
});

function tokenExpiryToDays(expiry?: string) {
  switch (expiry) {
    case 'FIVE_MINUTES':
      return (5 * 60) / 24 / 3600;
    case 'ONE_DAY':
      return 1;
    case 'SEVEN_DAYS':
      return 7;
    case 'THIRTY_DAYS':
      return 30;
    case 'SIXTY_DAYS':
      return 60;
    case 'NINETY_DAYS':
      return 90;
    case 'ONE_YEAR':
      return 365;
    default:
      return undefined;
  }
}

function tokenExpiryToTimestamp(expiry?: string) {
  const days = tokenExpiryToDays(expiry);
  if (!days) return undefined;
  return Date.now() + days * 24 * 3600 * 1000;
}

async function handleServiceAccountAction(
  ctx: Awaited<ReturnType<typeof withAppSiteContext>>,
  formAction: ServiceAccountAction,
  formData: FormData,
) {
  if (formAction === 'create-service-account') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.create, ctx.site.id)) {
      return data({ error: 'Not authorized to create service accounts' }, { status: 403 });
    }
    let createPayload: z.infer<typeof ServiceAccountCreateSchema>;
    try {
      createPayload = validateFormData(ServiceAccountCreateSchema, formData);
    } catch (error: any) {
      return data({ error: error.message ?? 'Invalid service account form data' }, { status: 422 });
    }
    const existing = await dbGetSiteServiceAccount(ctx.site.id);
    if (existing) return data({ error: 'Service account already exists' }, { status: 400 });
    const user = await dbCreateSiteServiceAccount(
      {
        id: ctx.site.id,
        name: ctx.site.name,
        title: ctx.site.title,
      },
      createPayload.role as SiteRole,
    );
    return data({ ok: true, userId: user.id });
  }

  if (formAction === 'delete-service-account') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.delete, ctx.site.id)) {
      return data({ error: 'Not authorized to delete service accounts' }, { status: 403 });
    }
    const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
    if (!serviceUser) return data({ error: 'Service account not found' }, { status: 404 });
    await dbDeleteSiteServiceAccount(ctx.site.id, serviceUser.id);
    return data({ ok: true });
  }

  if (formAction === 'create-service-token') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.tokens.create, ctx.site.id)) {
      return data({ error: 'Not authorized to create service account tokens' }, { status: 403 });
    }
    const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
    if (!serviceUser) return data({ error: 'Service account not found' }, { status: 404 });
    let tokenPayload: z.infer<typeof ServiceTokenCreateSchema>;
    try {
      tokenPayload = validateFormData(ServiceTokenCreateSchema, formData);
    } catch (error: any) {
      return data({ error: error.message ?? 'Invalid token form data' }, { status: 422 });
    }
    const timestampExpires = tokenExpiryToTimestamp(tokenPayload.expiry);
    const dateExpires = timestampExpires ? new Date(timestampExpires).toISOString() : undefined;
    const token = await dbCreateTokenForUser(serviceUser.id, tokenPayload.description, dateExpires);
    const signedToken = createUserToken(
      serviceUser,
      token.id,
      ctx.$config.api.userTokenAudience,
      ctx.$config.api.userTokenIssuer,
      tokenPayload.description,
      ctx.$config.api.tokenConfigUrl,
      ctx.$config.api.jwtSigningSecret,
      timestampExpires ? timestampExpires / 1000 : undefined,
    );
    const dto = dtoUserToken(token);
    return data({ token: signedToken, ...dto });
  }

  if (formAction === 'delete-service-token') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.tokens.delete, ctx.site.id)) {
      return data({ error: 'Not authorized to delete service account tokens' }, { status: 403 });
    }
    const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
    if (!serviceUser) return data({ error: 'Service account not found' }, { status: 404 });
    const tokenId = formData.get('tokenId');
    if (typeof tokenId !== 'string') return data({ error: 'Invalid token id' }, { status: 400 });
    const result = await dbDeleteTokenForUser(serviceUser.id, tokenId);
    return data(result);
  }

  return data({ error: 'Invalid form action' }, { status: 400 });
}

export async function action(args: ActionFunctionArgs) {
  // redirect: false here without a catch and custom error handling, with return a hard 403, resulting in an error page
  // this desired UX as the UI controls should be disabled if the user does not have permission
  const ctx = await withAppSiteContext(args, [siteScopes.users.update, siteScopes.users.delete], {
    redirect: false,
  });

  const formData = await args.request.formData();

  // Service account operations are dispatched on a `formAction` field; role
  // operations use an `intent` field. Branch here so we keep both schemas
  // independent of one another.
  const formAction = formData.get('formAction');
  if (isServiceAccountAction(formAction)) {
    return handleServiceAccountAction(ctx, formAction, formData);
  }

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
    if (!userHasSiteScope(ctx.user, siteScopes.users.admin, ctx.site.id)) {
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

/**
 * Skip loader revalidation after creating a service-account token so the
 * fetcher response (including the one-time secret) stays visible — same
 * pattern as app/settings/tokens.
 */
export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const formAction = formData?.get('formAction');
  if (formAction === 'create-service-token') {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function Users({ loaderData }: { loaderData: LoaderData }) {
  const {
    users,
    site,
    canUpdateRoles,
    canModifyAdminRoles,
    canViewServiceAccount,
    serviceAccount,
    serviceAccountPermissions,
    defaultServiceAccountName,
  } = loaderData;
  const [serviceTokenDone, setServiceTokenDone] = useState(false);

  const usersTab = (
    <div className="space-y-6">
      {canUpdateRoles && (
        <SectionWithHeading heading="Grant Roles" icon={UserPlus}>
          <div className="p-6 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <SiteRolesForm canGrantAdminRole={canModifyAdminRoles} />
          </div>
        </SectionWithHeading>
      )}

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
    </div>
  );

  return (
    <PageFrame
      title="Users & Access"
      subtitle={`Manage users, access and service accounts for ${site?.title}`}
    >
      {canViewServiceAccount ? (
        <ui.Tabs defaultValue="users" className="space-y-6">
          <ui.TabsList>
            <ui.TabsTrigger value="users">Users</ui.TabsTrigger>
            <ui.TabsTrigger value="service-accounts">Service Accounts</ui.TabsTrigger>
          </ui.TabsList>

          <ui.TabsContent value="users">{usersTab}</ui.TabsContent>

          <ui.TabsContent value="service-accounts">
            <ServiceAccountForm
              serviceAccount={serviceAccount}
              permissions={serviceAccountPermissions}
              defaultServiceAccountName={defaultServiceAccountName}
              tokenDone={serviceTokenDone}
              setTokenDone={setServiceTokenDone}
            />
          </ui.TabsContent>
        </ui.Tabs>
      ) : (
        usersTab
      )}
    </PageFrame>
  );
}
