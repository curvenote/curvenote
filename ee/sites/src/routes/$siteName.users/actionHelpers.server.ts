import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import type { SiteUser, User } from '@curvenote/scms-db';
import { SiteRole } from '@curvenote/scms-db';
import type { SiteContextWithUser, SiteContext } from '@curvenote/scms-server';
import { SlackEventType, userHasSiteScope } from '@curvenote/scms-server';
import {
  dbAddSiteUserRole,
  dbGetUserByEmail,
  dbGetUserById,
  dbRemoveSiteUserRole,
} from './db.server.js';
import { KnownResendEvents, site as siteScopes } from '@curvenote/scms-core';
import { SiteTrackEvent } from '../../analytics/events.js';

// User type that includes site_roles (as returned by dbGetUserById/dbGetUserByEmail)
type UserWithSiteRoles = User & {
  site_roles: Array<{ site_id: string; role: SiteRole }>;
};

// Schema for the action form data including intent
export const ActionFormDataSchema = zfd
  .formData({
    intent: zfd.text(z.union([z.literal('grant'), z.literal('revoke')])),
    // Accept either email or userId for backward compatibility and new search functionality
    email: zfd.text(z.email({ message: 'invalid email address' }).optional().or(z.literal(''))),
    userId: zfd.text(z.string().min(1).optional().or(z.literal(''))),
    role: zfd.text(z.union([z.literal('ADMIN'), z.literal('EDITOR'), z.literal('SUBMITTER')])),
  })
  .refine(
    (item) => {
      const hasUserId = item.userId && item.userId.trim().length > 0;
      const hasEmail = item.email && item.email.trim().length > 0;
      return hasUserId || hasEmail;
    },
    {
      message: 'Either email or userId must be provided',
      path: ['email'], // This will show the error on the email field
    },
  )
  .transform((item) => ({
    intent: item.intent,
    // Normalize empty strings to undefined
    email: item.email?.trim() || undefined,
    userId: item.userId?.trim() || undefined,
    role: item.role,
  }));

// Type for validated role update payload (without intent - intent is validated in route.tsx)
export type ParsedFormData = {
  email?: string;
  userId?: string;
  role: 'ADMIN' | 'EDITOR' | 'SUBMITTER';
};

function isErrorResponse<T>(value: T | ReturnType<typeof data>): value is ReturnType<typeof data> {
  return typeof value === 'object' && value !== null && 'status' in value;
}

async function fetchUserById(userId: string): Promise<UserWithSiteRoles | ReturnType<typeof data>> {
  const user = await dbGetUserById(userId);
  if (!user) {
    return data(
      { message: 'not found', error: 'no user found for provided userId' },
      { status: 404 },
    );
  }
  return user as UserWithSiteRoles;
}

async function fetchUserByEmail(
  email: string,
): Promise<UserWithSiteRoles | ReturnType<typeof data>> {
  const user = await dbGetUserByEmail(email);
  if (!user) {
    return data(
      { message: 'not found', error: 'no user found for provided email' },
      { status: 404 },
    );
  }
  return user as UserWithSiteRoles;
}

function ensureUserFound(
  user: UserWithSiteRoles | ReturnType<typeof data> | undefined,
): UserWithSiteRoles | ReturnType<typeof data> {
  if (!user || isErrorResponse(user)) {
    return data({ message: 'not found', error: 'user not found' }, { status: 404 });
  }
  return user;
}

/**
 * Shared helper function for user role management operations (grant/revoke).
 *
 * This function handles the common user lookup logic for role management:
 * 1. Fetches the target user by ID or email (from validated payload)
 * 2. Finds any existing role assignment for the target role on this site
 * 3. Invokes the provided `dbUpdate` callback with the validated data
 *
 * The function returns early with appropriate error responses if the user cannot be found:
 * - 404 (Not Found) if the user cannot be found
 *
 * **⚠️ IMPORTANT:**
 * - Form data validation must be done by the caller before invoking this function
 * - Authorization checks (scopes and role hierarchy) must be done by the caller
 *   before invoking this function
 *
 * @template T - The return type of the `dbUpdate` callback
 * @param ctx - Site context containing site information
 * @param payload - Validated form data containing `email` (optional), `userId` (optional), and `role`
 * @param dbUpdate - Callback function that performs the actual database operation
 * @returns The result of the `dbUpdate` callback, or an error response if user is not found
 */
async function getUserWithRoles<T>(
  ctx: SiteContext,
  payload: ParsedFormData,
  dbUpdate: (
    role: SiteRole,
    userWithRoles: UserWithSiteRoles,
    requestedRole?: SiteUser,
  ) => Promise<T>,
) {
  const { email, userId, role } = payload;

  // At this point, Zod has validated that at least one of email or userId is provided
  // and email format is valid if email is provided
  let userWithRoles: UserWithSiteRoles | ReturnType<typeof data> | undefined;

  if (userId) {
    userWithRoles = await fetchUserById(userId);
  } else if (email) {
    userWithRoles = await fetchUserByEmail(email);
  }

  const user = ensureUserFound(userWithRoles);
  if (isErrorResponse(user)) {
    return user;
  }

  const existingRoleIfOnTargetUser = user.site_roles.find(
    (site_role: { site_id: string; role: SiteRole }) => {
      return site_role.site_id === ctx.site.id && site_role.role === role;
    },
  ) as SiteUser | undefined;

  const resp = await dbUpdate(role, user, existingRoleIfOnTargetUser);
  return resp;
}

/**
 * Grant a site role to a user.
 *
 * **⚠️ IMPORTANT: Authorization is assumed to be done by the caller.**
 *
 * This function expects that the caller has already verified:
 * - The actor has the required scopes (e.g., `site.users.update`)
 * - The actor has permission to grant the target role (role hierarchy check)
 *
 * The function performs:
 * - Validation that the target user doesn't already have the role
 *
 * Authorization should be performed in the route handler using:
 * - `withAppSiteContext()` to check required scopes
 * - `canModifySiteRole()` or `canGrantSiteRole()` to check role hierarchy permissions
 *
 * @param ctx - Site context with authenticated user
 * @param payload - Validated form data containing `userId` or `email` and `role`
 * @returns Success response or error response
 */
export async function $actionGrantUserRole(ctx: SiteContextWithUser, payload: ParsedFormData) {
  return getUserWithRoles(ctx, payload, async (role, userWithRoles, existingRoleIfOnTargetUser) => {
    // Prevent non-admins from modifying their own roles
    if (ctx.user.id === userWithRoles.id && !userHasSiteScope(ctx.user, siteScopes.users.admin, ctx.site.id)) {
      return data(
        {
          error: {
            type: 'general',
            message: 'Only admins can modify their own roles',
          },
        },
        { status: 403 },
      );
    }

    if (existingRoleIfOnTargetUser) {
      return { message: 'ok', info: 'user already has the requested role' };
    }
    await dbAddSiteUserRole(ctx.site.id, userWithRoles.id, role);

    if (userWithRoles.email) {
      await ctx.sendEmail({
        eventType: KnownResendEvents.SITE_INVITATION,
        to: userWithRoles.email,
        subject: `You've been invited to join ${ctx.site.name}`,
        templateProps: {
          siteName: ctx.site.name,
          siteUrl: ctx.asBaseUrl(`/app/sites/${ctx.site.name}`),
          role: role.toLowerCase(),
          inviterName: ctx.user.display_name || ctx.user.username || undefined,
          inviterEmail: ctx.user.email ?? undefined,
        },
      });
    }

    await ctx.sendSlackNotification({
      eventType: SlackEventType.SITE_ROLE_GRANTED,
      message: `User role ${role} granted to ${userWithRoles.display_name}`,
      user: ctx.user,
      metadata: {
        grantedUserId: userWithRoles.id,
        grantedUserEmail: userWithRoles.email,
        site: ctx.site.name,
        role,
      },
    });

    await ctx.trackEvent(SiteTrackEvent.SITE_ROLE_GRANTED, {
      grantedUserId: userWithRoles.id,
      grantedUserEmail: userWithRoles.email,
      grantedUserDisplayName: userWithRoles.display_name,
      role: role,
    });

    await ctx.analytics.flush();

    return { message: 'created', info: 'user role granted' };
  });
}

/**
 * Revoke a site role from a user.
 *
 * **⚠️ IMPORTANT: Authorization is assumed to be done by the caller.**
 * This function expects that the caller has already verified:
 * - The actor has the required scopes (e.g., `site.users.delete`)
 * - The actor has permission to modify the target role (role hierarchy check)
 *
 * The function performs:
 * - Validation that the user has the role to revoke
 * - Self-protection check (prevents non-admins from modifying their own roles)
 * - Self-protection check (prevents users from revoking their own admin role, even admins)
 *
 * Authorization should be performed in the route handler using:
 * - `withAppSiteContext()` to check required scopes
 * - `canModifySiteRole()` to check role hierarchy permissions
 *
 * @param ctx - Site context with authenticated user
 * @param payload - Validated form data containing `userId` or `email` and `role`
 * @returns Success response or error response
 */
export async function $actionRevokeUserRole(ctx: SiteContextWithUser, payload: ParsedFormData) {
  return getUserWithRoles(ctx, payload, async (role, userWithRoles, existingRoleIfOnTargetUser) => {
    if (!existingRoleIfOnTargetUser) {
      return data(
        {
          error: {
            type: 'general',
            message: 'user does not have specified role, cannot revoke it',
          },
        },
        { status: 422 },
      );
    }

    // Prevent non-admins from modifying their own roles
    if (ctx.user.id === userWithRoles.id && !userHasSiteScope(ctx.user, siteScopes.users.admin, ctx.site.id)) {
      return data(
        {
          error: {
            type: 'general',
            message: 'Only admins can modify their own roles',
          },
        },
        { status: 403 },
      );
    }

    // Prevent users from revoking their own admin role (even admins)
    if (role === SiteRole.ADMIN && ctx.user.id === userWithRoles.id) {
      return data(
        {
          error: {
            type: 'general',
            message: 'cannot revoke your own admin permissions',
          },
        },
        { status: 422 },
      );
    }
    await dbRemoveSiteUserRole(ctx.site.id, userWithRoles.id, role);
    await ctx.sendSlackNotification({
      eventType: SlackEventType.SITE_ROLE_REVOKED,
      message: `User role ${role} revoked from ${userWithRoles.display_name}`,
      user: ctx.user,
      metadata: {
        revokedUserId: userWithRoles.id,
        revokedUserEmail: userWithRoles.email,
        site: ctx.site.name,
        role,
      },
    });

    await ctx.trackEvent(SiteTrackEvent.SITE_ROLE_REVOKED, {
      revokedUserId: userWithRoles.id,
      revokedUserEmail: userWithRoles.email,
      revokedUserDisplayName: userWithRoles.display_name,
      role: role,
    });

    await ctx.analytics.flush();

    return { message: 'ok', info: 'user role revoked' };
  });
}
