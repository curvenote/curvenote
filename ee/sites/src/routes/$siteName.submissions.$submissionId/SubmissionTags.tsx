import { useFetcher, useLoaderData } from 'react-router';
import type { TagDTO } from '@curvenote/common';
import { cn, ui } from '@curvenote/scms-core';
import { Plus } from 'lucide-react';
import type { SubmissionDetailPageData } from './loader.server.js';
import { TagPicker } from './TagPicker.js';
import { getTagAddControlKind, getTagAddTriggerLabel } from './SubmissionTags.utils.js';

type SubmissionTagsProps = {
  submissionId: string;
  tags: TagDTO[];
  canUpdate: boolean;
};

const TAG_ADD_CONTROL_CLASS = cn(
  'inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-600',
  'dark:border-gray-600 dark:text-gray-400',
);

function TagAddControl({ kind }: { kind: 'add-tags' | 'plus' }) {
  return (
    <span className={TAG_ADD_CONTROL_CLASS}>
      <Plus className="size-3" aria-hidden />
      {kind === 'add-tags' ? 'Add Tags' : null}
    </span>
  );
}

export function SubmissionTags({ submissionId, tags, canUpdate }: SubmissionTagsProps) {
  const { siteTags } = useLoaderData<SubmissionDetailPageData>();
  const fetcher = useFetcher<{ error?: string; tag?: TagDTO }>();
  const assignedIds = tags.map((tag) => tag.id);
  const pickerBusy = fetcher.state !== 'idle';

  const toggle = (tag: TagDTO) => {
    if (pickerBusy) {
      return;
    }
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
    if (pickerBusy) {
      return;
    }
    fetcher.submit(
      { submission_id: submissionId, label, formAction: 'tag-assign' },
      { method: 'POST' },
    );
  };

  const chips = tags.map((tag) => (
    <ui.Badge key={tag.id} variant="outline-muted" size="xs" title={tag.name}>
      {tag.label}
    </ui.Badge>
  ));

  if (!canUpdate) {
    const addKind = getTagAddControlKind({ permission: 'read', assignedCount: tags.length });
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {chips}
        {addKind === 'add-tags' ? (
          <button
            type="button"
            className="text-left disabled:cursor-not-allowed disabled:opacity-50"
            disabled
            aria-label="Add Tags"
          >
            <TagAddControl kind="add-tags" />
          </button>
        ) : null}
      </div>
    );
  }

  const addKind = getTagAddControlKind({ permission: 'update', assignedCount: tags.length });

  return (
    <div className="flex flex-wrap gap-2 items-center w-full min-w-0">
      <TagPicker
        catalog={siteTags}
        assignedIds={assignedIds}
        disabled={pickerBusy}
        onToggle={toggle}
        onCreate={create}
      >
        <button
          type="button"
          className="flex flex-wrap gap-1 items-center text-left disabled:cursor-not-allowed disabled:opacity-50"
          title={getTagAddTriggerLabel(addKind)}
          aria-label={getTagAddTriggerLabel(addKind)}
          disabled={pickerBusy}
        >
          {chips}
          <TagAddControl kind={addKind} />
        </button>
      </TagPicker>
      {fetcher.data?.error ? (
        <span className="text-sm text-destructive">{fetcher.data.error}</span>
      ) : null}
    </div>
  );
}
