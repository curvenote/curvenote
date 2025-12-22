import { getPrismaClient } from '@curvenote/scms-server';
import type { Prisma } from '@prisma/client';

export type AnalyticsDashboardDTO = Prisma.AnalyticsDashboardGetPayload<{
  include: {
    site: {
      select: {
        id: true;
        name: true;
        title: true;
      };
    };
  };
}>;

export async function dbGetAnalyticsDashboards() {
  const prisma = await getPrismaClient();
  return prisma.analyticsDashboard.findMany({
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
    orderBy: [{ type: 'asc' }, { title: 'asc' }],
  });
}

export async function dbGetAnalyticsDashboard(id: string) {
  const prisma = await getPrismaClient();
  return prisma.analyticsDashboard.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
  });
}

export async function dbCreateAnalyticsDashboard(data: {
  id: string;
  title: string;
  description?: string;
  type: 'PLATFORM' | 'SITE';
  url: string;
  site_id?: string;
  enabled?: boolean;
}) {
  const prisma = await getPrismaClient();
  const dateCreated = new Date().toISOString();

  return prisma.analyticsDashboard.create({
    data: {
      ...data,
      date_created: dateCreated,
      date_modified: dateCreated,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
  });
}

export async function dbUpdateAnalyticsDashboard(
  id: string,
  data: {
    title?: string;
    description?: string;
    type?: 'PLATFORM' | 'SITE';
    url?: string;
    site_id?: string;
    enabled?: boolean;
  },
) {
  const prisma = await getPrismaClient();
  const dateModified = new Date().toISOString();

  return prisma.analyticsDashboard.update({
    where: { id },
    data: {
      ...data,
      date_modified: dateModified,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
  });
}

export async function dbDeleteAnalyticsDashboard(id: string) {
  const prisma = await getPrismaClient();
  return prisma.analyticsDashboard.delete({
    where: { id },
  });
}

export async function dbGetSites() {
  const prisma = await getPrismaClient();
  return prisma.site.findMany({
    select: {
      id: true,
      name: true,
      title: true,
    },
    orderBy: { title: 'asc' },
  });
}
