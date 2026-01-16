import { getPrismaClient } from '@curvenote/scms-server';
import { KnownResendEvents } from '@curvenote/scms-core';
import { $Enums } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';
import type { SecureContext } from '@curvenote/scms-server';

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
        activity_type: disabled
          ? $Enums.ActivityType.USER_DISABLED
          : $Enums.ActivityType.USER_ENABLED,
        user_id: id,
        status: disabled ? 'DISABLED' : 'ENABLED',
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
        activity_type: $Enums.ActivityType.USER_APPROVED,
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
        activity_type: $Enums.ActivityType.USER_REJECTED,
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
