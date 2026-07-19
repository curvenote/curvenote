import type { Prisma } from '@curvenote/scms-db';

/** Minimal version row attached to a listing submission (≤3 per submission). */
export type ListingVersionChip = {
  id: string;
  submission_id: string;
  status: string;
  date_created: string;
  transition: Prisma.JsonValue;
  job_id: string | null;
  work_version: { work_id: string };
};

/**
 * Resolves the card "active" version id using the same rules as findImportantVersions,
 * without loading every submission version.
 */
export function pickListingActiveVersionId(
  newest: Pick<ListingVersionChip, 'id' | 'status' | 'date_created'> | undefined,
  published: Pick<ListingVersionChip, 'id' | 'date_created'> | undefined,
): string | undefined {
  if (!newest) {
    return published?.id;
  }
  if (
    (newest.status === 'PENDING' || newest.status === 'APPROVED') &&
    (!published || newest.date_created > published.date_created)
  ) {
    return newest.id;
  }
  return published?.id ?? newest.id;
}

/** Merge snapshot rows in date_created desc order for findImportantVersions. */
export function mergeListingVersionChips(chips: {
  newest?: ListingVersionChip;
  published?: ListingVersionChip;
  retracted?: ListingVersionChip;
}): ListingVersionChip[] {
  const byId = new Map<string, ListingVersionChip>();
  for (const chip of [chips.newest, chips.published, chips.retracted]) {
    if (chip) {
      byId.set(chip.id, chip);
    }
  }
  return [...byId.values()].sort((a, b) => b.date_created.localeCompare(a.date_created));
}

/** Version statuses only — used to pick active / published / retracted rows for the listing card. */
export function findImportantVersions(versions: { status: string }[]): {
  published?: number;
  retracted?: number;
  active?: number;
} {
  const idxs: {
    published?: number;
    retracted?: number;
    active?: number;
  } = {
    published: undefined,
    retracted: undefined,
    active: undefined,
  };
  const statuses = versions.map((v) => v.status);

  for (let i = 0; i < statuses.length; i++) {
    if (
      idxs.published === undefined &&
      idxs.active === undefined &&
      (statuses[i] === 'PENDING' || statuses[i] === 'APPROVED')
    ) {
      idxs.active = i;
    }
    if (idxs.published === undefined && statuses[i] === 'PUBLISHED') {
      idxs.published = i;
    }
    if (idxs.retracted === undefined && statuses[i] === 'RETRACTED') {
      idxs.retracted = i;
    }
  }

  return idxs;
}
