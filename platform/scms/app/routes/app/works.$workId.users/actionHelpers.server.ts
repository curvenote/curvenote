import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import type { User, WorkUser } from '@curvenote/scms-db';
import { $Enums } from '@curvenote/scms-db';
import {
  dbAddWorkUserRole,
  dbGetUserByEmail,
  dbGetUserById,
  dbRemoveWorkUserRole,
} from './db.server';
import type { GeneralError } from '@curvenote/scms-core';
import { TrackEvent, KnownResendEvents } from '@curvenote/scms-core';
import type { WorkContext } from '@curvenote/scms-server';
import { works } from '@curvenote/scms-server';

const UpdateWorkRoleObject = {
  email: zfd.text(z.string().email({ message: 'invalid email address' }).trim().toLowerCase()),
  role: zfd.text(z.union([z.literal('OWNER'), z.literal('CONTRIBUTOR'), z.literal('VIEWER')])),
};

const UpdateWorkRoleByIdObject = {
  userId: zfd.text(z.string()),
  role: zfd.text(z.union([z.literal('OWNER'), z.literal('CONTRIBUTOR'), z.literal('VIEWER')])),
};

async function getUserWithRolesByEmail(
  ctx: WorkContext,
  formData: FormData,
  dbUpdate: (
    role: $Enums.WorkRole,
    userWithRoles: User,
    requestedRole?: WorkUser,
  ) => Promise<{ message: string; error?: string; status?: number }>,
) {
  const UpdateWorkRoleSchema = zfd.formData(UpdateWorkRoleObject);
  let payload;
  try {
    payload = UpdateWorkRoleSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return { message: 'unprocessable content', error: error?.issues?.[0]?.message, status: 422 };
  }
  const { email, role } = payload;
  const userWithRoles = await dbGetUserByEmail(email);
  if (!userWithRoles) {
    return { message: 'not found', error: 'no user found for provided email', status: 404 };
  }
  const requestedRole = userWithRoles.work_roles.find((work_role) => {
    return work_role.work_id === ctx.work.id && work_role.role === role;
  });
  return dbUpdate(role, userWithRoles, requestedRole);
}

async function getUserWithRolesById(
  ctx: WorkContext,
  formData: FormData,
  dbUpdate: (
    role: $Enums.WorkRole,
    userWithRoles: User,
    requestedRole?: WorkUser,
  ) => Promise<{ message: string; error?: string; status?: number }>,
) {
  const UpdateWorkRoleByIdSchema = zfd.formData(UpdateWorkRoleByIdObject);
  let payload;
  try {
    payload = UpdateWorkRoleByIdSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return { message: 'unprocessable content', error: error?.issues?.[0]?.message, status: 422 };
  }
  const { userId, role } = payload;
  const userWithRoles = await dbGetUserById(userId);
  if (!userWithRoles) {
    return { message: 'not found', error: 'no user found for provided userId', status: 404 };
  }
  const requestedRole = userWithRoles.work_roles.find((work_role) => {
    return work_role.work_id === ctx.work.id && work_role.role === role;
  });
  return dbUpdate(role, userWithRoles, requestedRole);
}

export async function actionGrantUserRole(ctx: WorkContext, formData: FormData) {
  const userId = formData.get('userId');

  // Determine which method to use based on available data
  const getUserFn = userId ? getUserWithRolesById : getUserWithRolesByEmail;

  const { message, error, status } = await getUserFn(
    ctx,
    formData,
    async (role, userWithRoles, requestedRole) => {
      if (requestedRole) {
        return { message: 'ok', info: 'user already has requested role' };
      }
      await dbAddWorkUserRole(ctx.work.id, userWithRoles.id, role);

      await ctx.trackEvent(TrackEvent.WORK_ROLE_GRANTED, {
        grantedUserId: userWithRoles.id,
        grantedUserEmail: userWithRoles.email,
        grantedUserDisplayName: userWithRoles.display_name,
        role: role,
      });

      await ctx.analytics.flush();

      if (userWithRoles.email && ctx.user) {
        const version = ctx.work.versions
          ? works.getCanonicalOrLatestVersion(ctx.work.versions)
          : undefined;
        const workTitle = version?.title || 'Untitled Work';

        await ctx.sendEmail({
          eventType: KnownResendEvents.WORK_INVITATION,
          to: userWithRoles.email,
          subject: `You've been invited to join ${workTitle}`,
          templateProps: {
            workTitle: workTitle,
            workUrl: ctx.asBaseUrl(`/app/works/${ctx.work.id}`),
            role: role.toLowerCase(),
            inviterName: ctx.user.display_name || ctx.user.username || undefined,
            inviterEmail: ctx.user.email ?? undefined,
          },
        });
      }

      return { message: 'created', info: 'user role granted' };
    },
  );

  if (error) {
    return data({ error: { type: 'general', message: error } as GeneralError }, { status });
  }

  return { message };
}

export async function actionRevokeUserRole(ctx: WorkContext, formData: FormData) {
  const userId = formData.get('userId');

  // Determine which method to use based on available data
  const getUserFn = userId ? getUserWithRolesById : getUserWithRolesByEmail;

  const { message, error, status } = await getUserFn(
    ctx,
    formData,
    async (role, userWithRoles, requestedRole) => {
      if (!requestedRole) {
        return { message: 'ok', info: 'user does not have specified role' };
      }
      if (role === $Enums.WorkRole.OWNER && ctx.user?.id === userWithRoles.id) {
        return {
          message: 'unprocessable content',
          error: 'cannot revoke your own owner permissions',
          status: 422,
        };
      }
      await dbRemoveWorkUserRole(ctx.work.id, userWithRoles.id, role);

      await ctx.trackEvent(TrackEvent.WORK_ROLE_REVOKED, {
        revokedUserId: userWithRoles.id,
        revokedUserEmail: userWithRoles.email,
        revokedUserDisplayName: userWithRoles.display_name,
        role: role,
      });

      await ctx.analytics.flush();

      return { message: 'ok', info: 'user role revoked' };
    },
  );

  if (error) {
    return data({ error: { type: 'general', message: error } as GeneralError }, { status });
  }

  return { message };
}
