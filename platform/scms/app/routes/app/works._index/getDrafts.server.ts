import { dbFindSingleVersionDraftFileWorksForUser } from '../works.$workId.upload.$workVersionId/db.server';

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
 * Check if a draft work is valid for reuse in the Resume-draft dialog.
 * Caller must pass works that already have exactly one version and that version is draft.
 * This only checks that the version has the 'checks' field in metadata (required for upload flow).
 */
export function isValidDraftForReuse(work: { versions: { metadata: unknown }[] }): boolean {
  if (work.versions.length !== 1) {
    return false;
  }
  const metadata = work.versions[0].metadata as Record<string, unknown> | null;
  return Boolean(metadata && 'checks' in metadata);
}

/**
 * Get draft works for the "Resume draft" dialog on My Works / New Work.
 * Only returns works that have exactly one work version and that version is draft
 * (so we don't show "new version" drafts that are managed from Work Details).
 * Also requires the 'checks' field in version metadata.
 */
export async function getValidDraftWorksForUser(userId: string): Promise<DraftListItem[]> {
  const draftWorks = await dbFindSingleVersionDraftFileWorksForUser(userId);
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
