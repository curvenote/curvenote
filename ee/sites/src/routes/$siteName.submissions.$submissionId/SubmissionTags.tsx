import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { useFetcher, useLoaderData } from 'react-router';
import type { TagDTO } from '@curvenote/common';
import { ui } from '@curvenote/scms-core';
import { Plus } from 'lucide-react';
import type { SubmissionDetailPageData } from './loader.server.js';
import { TagPicker } from './TagPicker.js';
import { getTagAddControlKind, getTagAddTriggerLabel } from './SubmissionTags.utils.js';

type SubmissionTagsProps = {
  submissionId: string;
  tags: TagDTO[];
  canUpdate: boolean;
};

type TagAddButtonProps = {
  kind: 'add-tags' | 'plus';
} & Omit<ComponentPropsWithoutRef<typeof ui.Button>, 'children' | 'value'>;

const TagAddButton = forwardRef<HTMLButtonElement, TagAddButtonProps>(function TagAddButtonTrigger(
  { kind, ...props },
  ref,
) {
  const label = getTagAddTriggerLabel(kind);
  const compact = kind === 'plus';
  return (
    <ui.Button
      ref={ref}
      type="button"
      variant="ghost"
      size={compact ? 'icon-xs' : 'xs'}
      title={label}
      aria-label={label}
      {...props}
    >
      <Plus aria-hidden />
      {compact ? null : label}
    </ui.Button>
  );
});

export function SubmissionTags({ submissionId, tags, canUpdate }: SubmissionTagsProps) {
  const { siteTags } = useLoaderData<SubmissionDetailPageData>();
  const fetcher = useFetcher<{ error?: string; tag?: TagDTO }>();
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const openPicker = () => {
    if (pickerBusy) {
      return;
    }
    setPickerOpen(true);
  };

  if (!canUpdate) {
    const addKind = getTagAddControlKind({ permission: 'read', assignedCount: tags.length });
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <ui.Badge key={tag.id} variant="outline-muted" size="xs" title={tag.name}>
            {tag.label}
          </ui.Badge>
        ))}
        {addKind === 'add-tags' ? <TagAddButton kind="add-tags" disabled /> : null}
      </div>
    );
  }

  const addKind = getTagAddControlKind({ permission: 'update', assignedCount: tags.length });

  return (
    <div className="flex flex-wrap gap-1 items-center w-full min-w-0">
      {tags.map((tag) => (
        <ui.Badge key={tag.id} variant="outline-muted" size="xs" title={tag.name} asChild>
          <button type="button" onClick={openPicker}>
            {tag.label}
          </button>
        </ui.Badge>
      ))}
      <TagPicker
        catalog={siteTags}
        assignedIds={assignedIds}
        disabled={pickerBusy}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onToggle={toggle}
        onCreate={create}
      >
        <TagAddButton kind={addKind} disabled={pickerBusy} />
      </TagPicker>
      {fetcher.data?.error ? (
        <span className="text-sm text-destructive">{fetcher.data.error}</span>
      ) : null}
    </div>
  );
}
