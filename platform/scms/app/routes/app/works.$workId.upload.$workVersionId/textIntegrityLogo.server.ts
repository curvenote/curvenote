import type { SecureContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';

const TEXT_INTEGRITY_CONFIG_OBJECT_TYPE = 'extension:text-integrity:config';

export type TextIntegrityDesignManifest = {
  name: string;
  title: string;
  logo: string;
  version: string;
};

function parseManifestFromObjectData(data: unknown): TextIntegrityDesignManifest | undefined {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const manifest = (data as Record<string, unknown>).manifest;
  if (manifest == null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return undefined;
  }
  const m = manifest as Record<string, unknown>;
  const name = typeof m.name === 'string' ? m.name.trim() : '';
  const title = typeof m.title === 'string' ? m.title.trim() : '';
  const logo = typeof m.logo === 'string' ? m.logo.trim() : '';
  const version = typeof m.version === 'string' ? m.version.trim() : '';
  if (!name || !title || !logo || !version) return undefined;
  return { name, title, logo, version };
}

async function readTextIntegrityManifestFromObjectStore(): Promise<
  TextIntegrityDesignManifest | undefined
> {
  const prisma = await getPrismaClient();
  const row = await prisma.object.findFirst({
    where: { type: TEXT_INTEGRITY_CONFIG_OBJECT_TYPE },
    orderBy: { date_modified: 'desc' },
    select: { data: true },
  });
  return parseManifestFromObjectData(row?.data);
}

function relayLogoFallback(ctx: SecureContext): string | undefined {
  const checks = ctx.$config.app?.checks as Record<string, unknown> | undefined;
  const relayBaseUrl =
    typeof checks?.relayBaseUrl === 'string' ? checks.relayBaseUrl.trim().replace(/\/$/, '') : '';
  return relayBaseUrl ? `${relayBaseUrl}/api/assets/ithenticate/logo.svg` : undefined;
}

/** Manifest from text-integrity Object config (checks-relay service status), with relay fallback. */
export async function resolveTextIntegrityDesignManifest(
  ctx: SecureContext,
): Promise<TextIntegrityDesignManifest> {
  const fromStore = await readTextIntegrityManifestFromObjectStore();
  if (fromStore) return fromStore;

  const fallbackLogo = relayLogoFallback(ctx);
  return {
    name: 'ithenticate',
    title: 'iThenticate',
    logo: fallbackLogo ?? '',
    version: '1.0.0',
  };
}

/** Logo URL from text-integrity Object config manifest (checks-relay service status). */
export async function getTextIntegrityLogoUrlFromObjectStore(): Promise<string | undefined> {
  const manifest = await readTextIntegrityManifestFromObjectStore();
  return manifest?.logo;
}
