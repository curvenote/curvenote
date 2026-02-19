import { dbFindDraftFileWorksForUser } from '../works.$workId.upload.$workVersionId/db.server';

/**
 * Draft list item shape returned by getValidDraftWorksForUser (matches DraftWork from scms-core).
 */
export type DraftListItem = {
  workId: string;
  workVersionId: string;
  workTitle: string;
  dateModified: string;
  dateCreated: string;
  metadata: unknown;
};

/**
 * Check if a draft work is valid for reuse.
 * Valid drafts must have exactly one work version and the 'checks' field in metadata.
 */
export function isValidDraftForReuse(work: { versions: { metadata: unknown }[] }): boolean {
  if (work.versions.length !== 1) {
    return false;
  }
  const metadata = work.versions[0].metadata as Record<string, unknown> | null;
  return Boolean(metadata && 'checks' in metadata);
}

/**
 * Get all valid draft works for a user (single version, with checks metadata).
 * Used by works._index action and works.new loader.
 */
export async function getValidDraftWorksForUser(userId: string): Promise<DraftListItem[]> {
  const draftWorks = await dbFindDraftFileWorksForUser(userId);
  const validDrafts = draftWorks.filter(isValidDraftForReuse);
  return validDrafts.map((work) => ({
    workId: work.id,
    workVersionId: work.versions[0].id,
    workTitle: work.versions[0].title || 'Untitled Work',
    dateModified: work.date_modified,
    dateCreated: work.date_created,
    metadata: work.versions[0].metadata,
  }));
}
