import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { formatDate } from '@curvenote/common';

export async function dbGetLinkedAccountsByUserId(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.userLinkedAccount.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      date_linked: 'asc',
    },
  });
}

export async function dbUpsertPendingLinkedAccount(userId: string, provider: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.userLinkedAccount.upsert({
    where: {
      uniqueProviderUserId: {
        user_id: userId,
        provider,
      },
    },
    update: {
      date_modified: timestamp,
      date_linked: null,
      pending: true,
    },
    create: {
      id: uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      date_linked: null,
      user_id: userId,
      provider,
      pending: true,
    },
  });
}

export async function dbDeleteLinkedAccount(userId: string, provider: string) {
  const prisma = await getPrismaClient();
  return prisma.userLinkedAccount.delete({
    where: {
      uniqueProviderUserId: {
        user_id: userId,
        provider,
      },
    },
  });
}
