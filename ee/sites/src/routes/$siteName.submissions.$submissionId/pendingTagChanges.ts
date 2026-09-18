import type { TagDTO } from '@curvenote/common';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';

const TAG_FETCHER_PREFIX = 'submission-tag';

/**
 * A tag as the chips and the picker render it: a {@link TagDTO} whose `id` may
 * still be missing. A tag being created is known by `name` and `label` before
 * the server responds, but gets its `id` only once it is stored, and the
 * optional `id` is what stops it being submitted in the meantime.
 */
export type SubmissionTagView = Omit<TagDTO, 'id'> & { id: string | undefined };

/** An in-flight tag submission. Keyed by `name`, which is unique per site and known before the server responds. */
export type PendingTagChange =
  { kind: 'assign' | 'remove'; name: string } | { kind: 'create'; name: string; label: string };

/** The fields of a `useFetchers()` entry read here, so specs do not need a router. */
export type TagFetcherSnapshot = {
  key: string;
  state: 'idle' | 'loading' | 'submitting';
  formData?: FormData;
};

function keyPrefix(submissionId: string): string {
  return `${TAG_FETCHER_PREFIX}:${submissionId}:`;
}

/** One fetcher per tag name, so a tag's in-flight change can be found and blocked. */
export function tagFetcherKey(submissionId: string, name: string): string {
  return `${keyPrefix(submissionId)}${name}`;
}

export function isTagFetcherKey(submissionId: string, key: string): boolean {
  return key.startsWith(keyPrefix(submissionId));
}

/**
 * Tag changes still in flight. A fetcher keeps its `formData` while the page
 * revalidates after the action, so a change stays pending until the loader
 * data that reflects it has arrived.
 */
export function readPendingTagChanges(
  fetchers: TagFetcherSnapshot[],
  submissionId: string,
): PendingTagChange[] {
  const pending: PendingTagChange[] = [];
  for (const fetcher of fetchers) {
    if (fetcher.state === 'idle' || !fetcher.formData) {
      continue;
    }
    if (!isTagFetcherKey(submissionId, fetcher.key)) {
      continue;
    }
    const name = fetcher.key.slice(keyPrefix(submissionId).length);
    const formAction = fetcher.formData.get('formAction');
    const label = fetcher.formData.get('label');
    if (formAction === SUBMISSION_DETAIL_FORM_ACTIONS.tagRemove) {
      pending.push({ kind: 'remove', name });
    } else if (
      formAction === SUBMISSION_DETAIL_FORM_ACTIONS.tagAssign &&
      typeof label === 'string'
    ) {
      pending.push({ kind: 'create', name, label: label.trim() });
    } else if (formAction === SUBMISSION_DETAIL_FORM_ACTIONS.tagAssign) {
      pending.push({ kind: 'assign', name });
    }
  }
  return pending;
}

export type ApplyPendingTagChangesInput = {
  tags: TagDTO[];
  catalog: TagDTO[];
  pending: PendingTagChange[];
};

export type SubmissionTagsView = {
  tags: SubmissionTagView[];
  catalog: SubmissionTagView[];
  busyNames: string[];
};

function byLabel(a: SubmissionTagView, b: SubmissionTagView): number {
  return a.label.localeCompare(b.label);
}

/**
 * Loader data with the pending changes applied. Union-based, so it stays
 * correct when a revalidation already contains a change that is still pending.
 */
export function applyPendingTagChanges({
  tags,
  catalog,
  pending,
}: ApplyPendingTagChangesInput): SubmissionTagsView {
  const catalogByName = new Map<string, SubmissionTagView>(catalog.map((tag) => [tag.name, tag]));
  const assignedByName = new Map<string, SubmissionTagView>(tags.map((tag) => [tag.name, tag]));

  for (const change of pending) {
    if (change.kind === 'remove') {
      assignedByName.delete(change.name);
      continue;
    }
    if (change.kind === 'create' && !catalogByName.has(change.name)) {
      catalogByName.set(change.name, { id: undefined, name: change.name, label: change.label });
    }
    const tag = assignedByName.get(change.name) ?? catalogByName.get(change.name);
    if (tag) {
      assignedByName.set(change.name, tag);
    }
  }

  return {
    tags: [...assignedByName.values()].sort(byLabel),
    catalog: [...catalogByName.values()].sort(byLabel),
    busyNames: pending.map((change) => change.name),
  };
}
