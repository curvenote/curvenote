import { uuidv7 as uuid } from 'uuidv7';
import type { Prisma } from '@prisma/client';
import { getPrismaClient, assertUserDefined } from '@curvenote/scms-server';
import type { Context } from '@curvenote/scms-core';

export async function dbListUserTokens(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.userToken.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      date_created: 'desc',
    },
  });
}

export async function dbDeleteUserToken(ctx: Context, tokenId: string) {
  assertUserDefined(ctx);
  const userId = ctx.user!.id;
  const prisma = await getPrismaClient();
  return prisma.userToken.deleteMany({
    where: {
      id: tokenId,
      user_id: userId,
    },
  });
}

export async function dbCreateUserToken(
  userId: string,
  description: string,
  date_expires?: string,
) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  return prisma.userToken.create({
    data: {
      user_id: userId,
      id: uuid(),
      description,
      date_created: timestamp,
      date_modified: timestamp,
      date_expires,
    },
  });
}

export type DBO = Exclude<Prisma.PromiseReturnType<typeof dbCreateUserToken>, null | undefined>;

export function dtoUserToken(dbo: DBO) {
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
