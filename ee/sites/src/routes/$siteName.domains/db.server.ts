import { getPrismaClient } from '@curvenote/scms-server';
import type { Domain } from '@prisma/client';
import { uuidv7 } from 'uuidv7';

export type { Domain };

export async function dbGetDomains(siteId: string): Promise<Domain[]> {
  const prisma = await getPrismaClient();
  return prisma.domain.findMany({ where: { site_id: siteId } });
}

export async function dbCreateDomain(
  site_name: string,
  hostname: string,
  is_default: boolean,
): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    // If this is going to be the default domain, unset any existing default
    if (is_default) {
      await tx.domain.updateMany({
        where: {
          site: { name: site_name },
          default: true,
        },
        data: {
          default: false,
        },
      });
    }

    const timestamp = new Date().toISOString();
    await tx.domain.create({
      data: {
        id: uuidv7(),
        hostname,
        site: { connect: { name: site_name } },
        default: is_default,
        date_created: timestamp,
        date_modified: timestamp,
      },
    });
  });
}

export async function dbDeleteDomain(domainId: string): Promise<void> {
  const prisma = await getPrismaClient();

  // First check if the domain is set as default
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
  });

  if (domain?.default) {
    throw new Error('Cannot delete default domain');
  }

  await prisma.domain.delete({
    where: { id: domainId },
  });
}

export async function dbSetDefaultDomain(domainId: string): Promise<void> {
  const prisma = await getPrismaClient();

  await prisma.$transaction(async (tx) => {
    // Get the domain we're setting as default
    const domain = await tx.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Unset any existing default domain for this site
    await tx.domain.updateMany({
      where: {
        site_id: domain.site_id,
        default: true,
      },
      data: {
        default: false,
      },
    });

    // Set the new default domain
    await tx.domain.update({
      where: { id: domainId },
      data: { default: true, date_modified: new Date().toISOString() },
    });
  });
}
