import { useFetchers, useSubmit } from 'react-router';
import type { TagDTO } from '@curvenote/common';
import { toTagName } from '@curvenote/scms-core';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';
import {
  applyPendingTagChanges,
  isTagFetcherKey,
  readPendingTagChanges,
  tagFetcherKey,
  type DisplayTagDTO,
} from './pendingTagChanges.js';

type UseSubmissionTagChangesParams = {
  submissionId: string;
  tags: TagDTO[];
  catalog: TagDTO[];
};

/**
 * Submits each tag change on its own fetcher, keyed by tag name, and returns
 * the loader data with in-flight changes applied. A tag with a change in flight
 * is busy: further toggles for it are ignored until it settles.
 *
 * Other fields on this page use one `useFetcher` per control and read its
 * `formData`. That holds a single pending change: a second submit replaces the
 * first `formData`, so the first change would vanish until revalidation. Tags
 * are changed several at a time, so each tag name gets its own keyed fetcher
 * (`useSubmit` with `fetcherKey`) and pending changes are read with `useFetchers()`.
 */
export function useSubmissionTagChanges({
  submissionId,
  tags,
  catalog,
}: UseSubmissionTagChangesParams) {
  const fetchers = useFetchers();
  const submit = useSubmit();
  const pending = readPendingTagChanges(fetchers, submissionId);
  const view = applyPendingTagChanges({ tags, catalog, pending });
  const fetcherKeys = fetchers
    .map((fetcher) => fetcher.key)
    .filter((key) => isTagFetcherKey(submissionId, key));

  const isBusy = (name: string) => view.busyNames.includes(name);

  const send = (name: string, fields: Record<string, string>) => {
    submit(
      { submission_id: submissionId, ...fields },
      { method: 'POST', navigate: false, fetcherKey: tagFetcherKey(submissionId, name) },
    );
  };

  const toggle = (tag: DisplayTagDTO) => {
    if (!tag.id || isBusy(tag.name)) {
      return;
    }
    const assigned = view.tags.some((candidate) => candidate.name === tag.name);
    send(tag.name, {
      tag_id: tag.id,
      formAction: assigned
        ? SUBMISSION_DETAIL_FORM_ACTIONS.tagRemove
        : SUBMISSION_DETAIL_FORM_ACTIONS.tagAssign,
    });
  };

  const create = (label: string) => {
    const trimmed = label.trim();
    const name = toTagName(trimmed);
    if (isBusy(name)) {
      return;
    }
    send(name, { label: trimmed, formAction: SUBMISSION_DETAIL_FORM_ACTIONS.tagAssign });
  };

  return { tags: view.tags, catalog: view.catalog, fetcherKeys, isBusy, toggle, create };
}
