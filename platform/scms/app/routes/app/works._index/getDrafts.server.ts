import { dbFindSingleVersionDraftFileWorksForUser } from '@curvenote/scms-server';
import { isArticleReusableDraft, type WorkCreateOption } from '@curvenote/scms-core';

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
  versionNumber: number;
};

/**
 * Check if a draft work is valid for reuse in the Article Resume-draft dialog.
 * Caller must pass works that already have exactly one version and that version is draft.
 * Requires `checks` in metadata and a resolved create option of Article (not an extension flow).
 */
export function isValidDraftForReuse(
  work: { versions: { metadata: unknown }[] },
  options: WorkCreateOption[],
): boolean {
  if (work.versions.length !== 1) {
    return false;
  }
  return isArticleReusableDraft(work.versions[0].metadata, options);
}

/**
 * Get draft works for the "Resume draft" dialog on My Works / New Work.
 * Only returns works that have exactly one work version and that version is draft
 * (so we don't show "new version" drafts that are managed from Work Details).
 * Also requires the 'checks' field in version metadata.
 */
export async function getValidDraftWorksForUser(
  userId: string,
  options: WorkCreateOption[],
): Promise<DraftListItem[]> {
  const draftWorks = await dbFindSingleVersionDraftFileWorksForUser(userId);
  const validDrafts = draftWorks.filter((work) => isValidDraftForReuse(work, options));
  return validDrafts.map((work) => ({
    workId: work.id,
    workVersionId: work.versions[0].id,
    workTitle: work.versions[0].title || 'Untitled Work',
    dateModified: work.date_modified,
    dateCreated: work.date_created,
    metadata: work.versions[0].metadata,
    versionNumber: 1,
  }));
}
