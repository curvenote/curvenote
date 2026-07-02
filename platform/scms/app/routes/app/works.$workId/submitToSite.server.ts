import { userHasScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';

type UserWithScopes = Parameters<typeof userHasScope>[0];

export type SubmitTargetSite = {
  name: string;
  external: boolean;
  private: boolean;
  restricted: boolean;
};

export type SubmitSiteCollection = {
  id: string;
  default: boolean;
  open: boolean;
  kindsInCollection: { kind: { id: string; default: boolean } }[];
};

export type SubmitSiteWithCollections = SubmitTargetSite & {
  id: string;
  collections: SubmitSiteCollection[];
  submissionKinds: { id: string; default: boolean }[];
};

export function canUserSubmitToSite(user: UserWithScopes, site: SubmitTargetSite): boolean {
  if (!site.private && !site.restricted) return true;
  return userHasScope(user, scopes.site.submissions.create, site.name);
}

export function resolveOpenCollection(collections: SubmitSiteCollection[]) {
  return (
    collections.find((item) => item.default && item.open) ?? collections.find((item) => item.open)
  );
}

export function resolveSubmissionKind(
  collection: SubmitSiteCollection | undefined,
  submissionKinds: { id: string; default: boolean }[],
) {
  const collectionKinds = collection?.kindsInCollection.map((item) => item.kind) ?? [];
  return (
    collectionKinds.find((item) => item.default) ??
    collectionKinds[0] ??
    submissionKinds.find((item) => item.default) ??
    submissionKinds[0]
  );
}

/** Whether a site can receive a first-time submission for a work (open collection + kind). */
export function canSiteAcceptNewSubmission(
  site: Pick<SubmitSiteWithCollections, 'collections' | 'submissionKinds'>,
): boolean {
  const collection = resolveOpenCollection(site.collections);
  if (!collection) return false;
  return Boolean(resolveSubmissionKind(collection, site.submissionKinds));
}

export function isSiteAvailableForWorkSubmit(
  user: UserWithScopes,
  site: SubmitSiteWithCollections,
  workSubmittedSiteIds: ReadonlySet<string>,
): boolean {
  if (!canUserSubmitToSite(user, site)) return false;
  if (workSubmittedSiteIds.has(site.id)) return true;
  return canSiteAcceptNewSubmission(site);
}
