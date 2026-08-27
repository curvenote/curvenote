import { useFetcher, useLoaderData } from 'react-router';
import type { TagDTO } from '@curvenote/common';
import { ui } from '@curvenote/scms-core';
import type { SubmissionDetailPageData } from './loader.server.js';
import { TagPicker } from './TagPicker.js';
import { emptyDetailValue } from './SubmissionDetails.utils.js';

type SubmissionTagsProps = {
  submissionId: string;
  tags: TagDTO[];
  canUpdate: boolean;
};

export function SubmissionTags({ submissionId, tags, canUpdate }: SubmissionTagsProps) {
  const { siteTags } = useLoaderData<SubmissionDetailPageData>();
  const fetcher = useFetcher<{ error?: string; tag?: TagDTO }>();
  const assignedIds = tags.map((tag) => tag.id);

  const toggle = (tag: TagDTO) => {
    fetcher.submit(
      {
        submission_id: submissionId,
        tag_id: tag.id,
        formAction: assignedIds.includes(tag.id) ? 'tag-remove' : 'tag-assign',
      },
      { method: 'POST' },
    );
  };

  const create = (label: string) => {
    fetcher.submit(
      { submission_id: submissionId, label, formAction: 'tag-assign' },
      { method: 'POST' },
    );
  };

  const chips = tags.length ? (
    tags.map((tag) => (
      <ui.Badge key={tag.id} variant="outline-muted" size="xs" title={tag.name}>
        {tag.label}
      </ui.Badge>
    ))
  ) : (
    <span className="text-sm text-muted-foreground">{emptyDetailValue()}</span>
  );

  if (!canUpdate) {
    return <div className="flex flex-wrap gap-1 items-center">{chips}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center w-full min-w-0">
      <TagPicker catalog={siteTags} assignedIds={assignedIds} onToggle={toggle} onCreate={create}>
        <button
          type="button"
          className="flex flex-wrap gap-1 items-center text-left"
          title="Add or remove tags"
          aria-label="Add or remove tags"
          disabled={fetcher.state !== 'idle'}
        >
          {chips}
        </button>
      </TagPicker>
      {fetcher.data?.error ? (
        <span className="text-sm text-destructive">{fetcher.data.error}</span>
      ) : null}
    </div>
  );
}
