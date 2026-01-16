import { getPrismaClient } from '@curvenote/scms-server';
import { $Enums } from '@curvenote/scms-db';

export type SystemUserDTO = Awaited<ReturnType<typeof dbGetSystemUsers>>[0];

export async function dbGetSystemUsers() {
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
    },
    orderBy: {
      display_name: 'asc',
    },
  });
}

export async function dbCountSystemUsers() {
  const prisma = await getPrismaClient();
  return prisma.user.count();
}

export async function dbUpdateUserSystemRole(userId: string, systemRole: string) {
  const prisma = await getPrismaClient();

  // Validate the system role
  const validRoles = Object.values($Enums.SystemRole) as string[];
  if (!validRoles.includes(systemRole)) {
    throw new Error('Invalid system role');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      system_role: systemRole as $Enums.SystemRole,
      date_modified: new Date().toISOString(),
    },
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      email: true,
      username: true,
      display_name: true,
      system_role: true,
    },
  });
}
