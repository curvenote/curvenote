import { getPrismaClient } from '@curvenote/scms-server';

export async function dbGetUsers() {
  const prisma = await getPrismaClient();
  return prisma.user.findMany({
    include: {
      site_roles: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      },
      linkedAccounts: {
        select: {
          id: true,
          provider: true,
          date_linked: true,
          pending: true,
          profile: true,
          idAtProvider: true,
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });
}
