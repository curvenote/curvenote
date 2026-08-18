import { signFilesInMetadata, type Context } from '@curvenote/scms-server';

export type LicenseDisplay = { text: string; tooltip?: string };

/** Prefer version DOI when non-empty after trim; otherwise work-level DOI. */
export function resolveWorkVersionDoi(
  versionDoi: string | null | undefined,
  workDoi: string | null | undefined,
): string | null {
  const trimmedVersion = versionDoi != null ? String(versionDoi).trim() : '';
  if (trimmedVersion) return trimmedVersion;
  const trimmedWork = workDoi != null ? String(workDoi).trim() : '';
  return trimmedWork || null;
}

export function getLicenseDisplayFromMetadata(metadata: unknown): LicenseDisplay | null {
  const meta = metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const record = meta as Record<string, unknown>;
    const license = record.license;
    if (license != null && license !== '') {
      if (typeof license === 'string') return { text: license };
      if (typeof license === 'object' && license !== null && 'content' in license) {
        const content = (license as { content?: { id?: string; name?: string } }).content;
        const id = content?.id ?? content?.name;
        if (id) return { text: String(id) };
      }
    }
  }
  return null;
}

export function computeCanResumeDraftUpload(
  canUpload: boolean,
  latestVersion: { draft: boolean } | undefined,
): boolean {
  return canUpload === true && latestVersion?.draft === true;
}

/** Signed file entries only — omit myst/checks/license from the client payload. */
export async function signVersionFilesForClient(
  version: { cdn: string | null },
  metadata: unknown,
  ctx: Context,
): Promise<{ files: Record<string, unknown> } | undefined> {
  const meta =
    metadata != null && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : null;
  if (!meta?.files || typeof meta.files !== 'object') return undefined;
  const signed = await signFilesInMetadata(
    meta as Parameters<typeof signFilesInMetadata>[0],
    version.cdn ?? '',
    ctx,
  );
  if (!signed.files || typeof signed.files !== 'object') return undefined;
  return { files: signed.files as Record<string, unknown> };
}
