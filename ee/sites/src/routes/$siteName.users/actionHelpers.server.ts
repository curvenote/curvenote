import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import type { SiteUser, User } from '@prisma/client';
import { SiteRole } from '@prisma/client';
import type { SiteContextWithUser, SiteContext } from '@curvenote/scms-server';
import {
  dbAddSiteUserRole,
  dbGetUserByEmail,
  dbGetUserById,
  dbRemoveSiteUserRole,
} from './db.server.js';
import { SlackEventType } from '@curvenote/scms-server';
import { KnownResendEvents } from '@curvenote/scms-core';
import { SiteTrackEvent } from '../../analytics/events.js';

const UpdateSiteRoleObject = {
  // Accept either email or userId for backward compatibility and new search functionality
  email: zfd.text(z.string().optional()),
  userId: zfd.text(z.string().optional()),
  role: zfd.text(z.union([z.literal('ADMIN'), z.literal('EDITOR'), z.literal('SUBMITTER')])),
};

async function getUserWithRoles<T>(
  ctx: SiteContext,
  formData: FormData,
  dbUpdate: (role: SiteRole, userWithRoles: User, requestedRole?: SiteUser) => Promise<T>,
) {
  const UpdateSiteRoleSchema = zfd.formData(UpdateSiteRoleObject);
  let payload;
  try {
    payload = UpdateSiteRoleSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return data(
      { message: 'unprocessable content', error: error?.issues?.[0]?.message },
      { status: 422 },
    );
  }
  const { email, userId, role } = payload;

  // Validate that either email or userId is provided
  if (!email && !userId) {
    return data(
      { message: 'unprocessable content', error: 'Either email or userId must be provided' },
      { status: 422 },
    );
  }

  // Get user by email or userId
  let userWithRoles;
  if (userId) {
    userWithRoles = await dbGetUserById(userId);
    if (!userWithRoles) {
      return data(
        { message: 'not found', error: 'no user found for provided userId' },
        { status: 404 },
      );
    }
  } else if (email) {
    // Validate email format if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return data(
        { message: 'unprocessable content', error: 'invalid email address' },
        { status: 422 },
      );
    }
    userWithRoles = await dbGetUserByEmail(email);
    if (!userWithRoles) {
      return data(
        { message: 'not found', error: 'no user found for provided email' },
        { status: 404 },
      );
    }
  }

  if (!userWithRoles) {
    return data({ message: 'not found', error: 'user not found' }, { status: 404 });
  }

  const requestedRole = userWithRoles.site_roles.find((site_role) => {
    return site_role.site_id === ctx.site.id && site_role.role === role;
  });
  const resp = await dbUpdate(role, userWithRoles, requestedRole);
  return resp;
}

export async function actionGrantUserRole(ctx: SiteContextWithUser, formData: FormData) {
  return getUserWithRoles(ctx, formData, async (role, userWithRoles, requestedRole) => {
    if (requestedRole) {
      return { message: 'ok', info: 'user already has requested role' };
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

export async function actionRevokeUserRole(ctx: SiteContext, formData: FormData) {
  return getUserWithRoles(ctx, formData, async (role, userWithRoles, requestedRole) => {
    if (!requestedRole) {
      return { message: 'ok', info: 'user does not have specified role' };
    }
    if (role === SiteRole.ADMIN && ctx.user?.id === userWithRoles.id) {
      return data(
        { message: 'unprocessable content', error: 'cannot revoke your own admin permissions' },
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
