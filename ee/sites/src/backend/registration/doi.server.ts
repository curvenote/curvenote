import { generateDoi } from 'crossref-utils-sdk';
import type { DoiDeps } from '../doi/types.js';

const MAX_ATTEMPTS = 5;

export type DoiReader = Pick<DoiDeps['prisma'], 'doiRegistration' | 'work' | 'workVersion'>;

async function isTaken(db: DoiReader, doi: string) {
  const [registration, work, version] = await Promise.all([
    db.doiRegistration.findFirst({ where: { doi }, select: { id: true } }),
    db.work.findFirst({ where: { doi }, select: { id: true } }),
    db.workVersion.findFirst({ where: { doi }, select: { id: true } }),
  ]);
  return registration !== null || work !== null || version !== null;
}

/**
 * A DOI under `prefix` that no registration and no work already uses. Checked outside a
 * transaction: the unique index on `DoiRegistration.doi` catches a concurrent pick, and work DOIs
 * are not written by this flow. `generateDoi` already emits lowercase suffixes.
 */
export async function generateFreeDoi(db: DoiReader, prefix: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const doi = generateDoi(prefix);
    if (!(await isTaken(db, doi))) {
      return doi;
    }
  }
  throw new Error(`Could not find a free DOI under ${prefix} in ${MAX_ATTEMPTS} attempts.`);
}
