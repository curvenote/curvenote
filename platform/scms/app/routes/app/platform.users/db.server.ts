import { getPrismaClient } from '@curvenote/scms-server';
import { KnownResendEvents } from '@curvenote/scms-core';
import { ActivityType, SystemRole } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';
import type { SecureContext, withAppPlatformAdminContext } from '@curvenote/scms-server';

/**
 * System roles that may be toggled between via the platform users UI.
 * Any other transition (ADMIN, SERVICE, same-value, unknown) is rejected.
 */
const TOGGLEABLE_SYSTEM_ROLES = new Set<SystemRole>([SystemRole.USER, SystemRole.ANON]);

export class InvalidSystemRoleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSystemRoleTransitionError';
  }
}

export type UserDTO = Awaited<ReturnType<typeof dbGetUsers>>[0];

export async function dbGetUsers() {
  const prisma = await getPrismaClient();
  return prisma.user.findMany({
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      email: true,
      username: true,
      display_name: true,
      system_role: true,
      primaryProvider: true,
      pending: true,
      ready_for_approval: true,
      disabled: true,
      site_roles: {
        include: {
          site: true,
        },
      },
      linkedAccounts: {
        select: {
          id: true,
          provider: true,
          date_linked: true,
          pending: true,
          profile: true,
        },
      },
      roles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              title: true,
              description: true,
              scopes: true,
            },
          },
        },
      },
    },
    orderBy: {
      display_name: 'asc',
    },
  });
}

export async function dbGetUserByIdForAnalytics(userId: string) {
  try {
    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        display_name: true,
        system_role: true,
        primaryProvider: true,
        pending: true,
        ready_for_approval: true,
        disabled: true,
        roles: {
          include: {
            role: {
              select: {
                name: true,
                scopes: true,
              },
            },
          },
        },
      },
    });
    return user;
  } catch (error) {
    console.error('dbGetUserByIdForAnalytics failed:', { userId, error });
    return null;
  }
}

/**
 * Best-effort analytics after a platform user mutation. Must not throw: the DB action
 * has already succeeded; failures here should not surface as 500 or prompt retries.
 */
export async function runPlatformUserAnalytics(
  ctx: Awaited<ReturnType<typeof withAppPlatformAdminContext>>,
  userId: string,
  run: () => Promise<void>,
) {
  try {
    const updatedUser = await dbGetUserByIdForAnalytics(userId);
    if (updatedUser) {
      await ctx.identifyEvent(updatedUser);
    }
    await run();
  } catch (error) {
    console.error('Platform user analytics failed:', { userId, error });
  }
}

export async function dbCountUsers() {
  const prisma = await getPrismaClient();
  return prisma.user.count({
    where: {
      system_role: 'USER',
    },
  });
}

export async function dbUpdateUserNullFields(
  id: string,
  data: { username: string; display_name: string },
) {
  const prisma = await getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { username: true, display_name: true }, // Fetch only relevant fields
  });

  if (user) {
    return prisma.user.update({
      where: { id },
      data: {
        username: user.username === null ? data.username : undefined,
        display_name: user.display_name === null ? data.display_name : undefined,
        date_modified: new Date().toISOString(),
      },
    });
  }

  throw new Error('User not found');
}

export async function dbToggleUserDisabled(
  id: string,
  disabled: boolean,
  activityByUserId: string,
) {
  const prisma = await getPrismaClient();
  const dateCreated = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        disabled,
        date_modified: dateCreated,
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: dateCreated,
        date_modified: dateCreated,
        activity_by_id: activityByUserId,
        activity_type: disabled ? ActivityType.USER_DISABLED : ActivityType.USER_ENABLED,
        user_id: id,
        status: disabled ? 'DISABLED' : 'ENABLED',
      },
    });

    return user;
  });
}

/**
 * Change a user's system role, but ONLY between USER and ANON.
 *
 * STRICT SERVER-SIDE VALIDATION:
 * - The requested `nextRole` MUST be 'USER' or 'ANON'.
 * - The target user's CURRENT `system_role` MUST also be 'USER' or 'ANON'.
 *   Users with ADMIN or SERVICE roles cannot be changed here — those must be
 *   managed through proper admin-elevation flows.
 * - The transition must actually change the role (no-ops are rejected).
 *
 * @throws InvalidSystemRoleTransitionError if any of the above invariants fail.
 */
export async function dbChangeUserSystemRoleBetweenUserAndAnon(
  userId: string,
  nextRole: SystemRole,
  activityByUserId: string,
) {
  if (!TOGGLEABLE_SYSTEM_ROLES.has(nextRole)) {
    throw new InvalidSystemRoleTransitionError(
      `system_role can only be changed to USER or ANON via this action (got "${nextRole}")`,
    );
  }

  const prisma = await getPrismaClient();
  const dateCreated = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { system_role: true },
    });

    if (!current) {
      throw new InvalidSystemRoleTransitionError(`User ${userId} not found`);
    }

    if (!TOGGLEABLE_SYSTEM_ROLES.has(current.system_role)) {
      throw new InvalidSystemRoleTransitionError(
        `Cannot change system_role for user ${userId} with current role "${current.system_role}" — only USER<->ANON transitions are allowed here`,
      );
    }

    if (current.system_role === nextRole) {
      throw new InvalidSystemRoleTransitionError(
        `User ${userId} already has system_role "${nextRole}"`,
      );
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        system_role: nextRole,
        date_modified: dateCreated,
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: dateCreated,
        date_modified: dateCreated,
        activity_by_id: activityByUserId,
        activity_type: ActivityType.ROLE_UPDATED,
        user_id: userId,
        status: nextRole,
        data: {
          system_role_change: {
            from: current.system_role,
            to: nextRole,
          },
        },
      },
    });

    return user;
  });
}

export async function dbApproveUser(userId: string, activityByUserId: string) {
  const prisma = await getPrismaClient();
  const dateCreated = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId, ready_for_approval: true },
      data: {
        pending: false,
        ready_for_approval: false,
        date_modified: dateCreated,
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: dateCreated,
        date_modified: dateCreated,
        activity_by_id: activityByUserId,
        activity_type: ActivityType.USER_APPROVED,
        user_id: userId,
        status: 'APPROVED',
      },
    });

    return user;
  });
}

export async function dbRejectUser(userId: string, activityByUserId: string) {
  const prisma = await getPrismaClient();
  const dateCreated = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId, ready_for_approval: true },
      data: {
        pending: true,
        ready_for_approval: true,
        disabled: true,
        date_modified: dateCreated,
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: dateCreated,
        date_modified: dateCreated,
        activity_by_id: activityByUserId,
        activity_type: ActivityType.USER_REJECTED,
        user_id: userId,
        status: 'REJECTED',
      },
    });

    return user;
  });
}

export async function approveAndNotifyUser(ctx: SecureContext, userId: string) {
  await dbApproveUser(userId, ctx.user!.id);
  const prisma = await getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (user?.email) {
    await ctx.sendEmail({
      eventType: KnownResendEvents.USER_WELCOME,
      to: user.email,
      subject: 'Your account has been approved!',
      templateProps: {
        approval: true,
      },
    });
  }
}
