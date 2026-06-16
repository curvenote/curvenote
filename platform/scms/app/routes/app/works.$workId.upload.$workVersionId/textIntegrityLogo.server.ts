import { getPrismaClient } from '@curvenote/scms-server';

const TEXT_INTEGRITY_CONFIG_OBJECT_TYPE = 'extension:text-integrity:config';

/** Logo URL from text-integrity Object config manifest (checks-relay service status). */
export async function getTextIntegrityLogoUrlFromObjectStore(): Promise<string | undefined> {
  const prisma = await getPrismaClient();
  const row = await prisma.object.findFirst({
    where: { type: TEXT_INTEGRITY_CONFIG_OBJECT_TYPE },
    orderBy: { date_modified: 'desc' },
    select: { data: true },
  });
  if (row?.data == null || typeof row.data !== 'object' || Array.isArray(row.data)) {
    return undefined;
  }
  const manifest = (row.data as Record<string, unknown>).manifest;
  if (manifest == null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return undefined;
  }
  const logo = (manifest as Record<string, unknown>).logo;
  return typeof logo === 'string' && logo.trim() !== '' ? logo.trim() : undefined;
}
