import { getPrismaClient } from '@curvenote/scms-server';

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
