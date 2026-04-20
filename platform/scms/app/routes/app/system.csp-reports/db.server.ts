import { getPrismaClient } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';

export type CspViolationReportDTO = Prisma.CspViolationReportGetPayload<{}>;

const DEFAULT_LIMIT = 200;

export async function dbGetCspViolationReports(limit = DEFAULT_LIMIT) {
  const prisma = await getPrismaClient();
  return prisma.cspViolationReport.findMany({
    orderBy: { date_last_seen: 'desc' },
    take: limit,
  });
}

export async function dbDeleteCspViolationReport(id: string) {
  const prisma = await getPrismaClient();
  return prisma.cspViolationReport.delete({ where: { id } });
}

export async function dbClearCspViolationReports() {
  const prisma = await getPrismaClient();
  return prisma.cspViolationReport.deleteMany({});
}

export async function dbCountCspViolationReports() {
  const prisma = await getPrismaClient();
  return prisma.cspViolationReport.count();
}
