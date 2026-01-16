import { uuidv7 as uuid } from 'uuidv7';
import { $Enums } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';

export async function dbAddWorkUserRole(workId: string, userId: string, role: $Enums.WorkRole) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  return prisma.workUser.create({
    data: {
      id: uuid(),
      // use same timestamp for created and modified
      date_created: timestamp,
      date_modified: timestamp,
      work_id: workId,
      user_id: userId,
      role,
    },
  });
}

export async function dbRemoveWorkUserRole(workId: string, userId: string, role: $Enums.WorkRole) {
  const prisma = await getPrismaClient();
  return prisma.workUser.deleteMany({
    where: {
      work_id: workId,
      user_id: userId,
      role,
    },
  });
}

export async function dbGetUserByEmail(email: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: { email },
    include: {
      work_roles: true,
    },
  });
}

export async function dbGetUserById(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: { id: userId },
    include: {
      work_roles: true,
    },
  });
}

export async function dbGetWorkUsers(workId: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findMany({
    where: {
      work_roles: {
        some: {
          work_id: workId,
        },
      },
    },
    include: {
      work_roles: {
        where: {
          work_id: workId,
        },
      },
    },
  });
}

export type DBO = Exclude<Awaited<ReturnType<typeof dbGetWorkUsers>>, null | undefined>;

export function dtoWorkUsers(dbo: DBO) {
  return dbo.map((user) => ({
    id: user.id,
    display_name: user.display_name,
    date_created: user.date_created,
    email: user.email,
    role: user.system_role,
    work_roles: user.work_roles.map((wr) => wr.role),
  }));
}
