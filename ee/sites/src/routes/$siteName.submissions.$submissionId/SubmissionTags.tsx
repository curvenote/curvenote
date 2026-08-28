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

type TagChipProps = {
  tag: TagDTO;
} & Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'type'>;

/** Forwards its ref to the button so the popover can anchor to the clicked chip. */
const TagChipButton = forwardRef<HTMLButtonElement, TagChipProps>(function TagChipTrigger(
  { tag, ...props },
  ref,
) {
  return (
    <ui.Badge
      variant="neutral"
      size="xs"
      title={tag.name}
      className="hover:bg-gray-200 dark:hover:bg-stone-600"
      asChild
    >
      <button ref={ref} type="button" {...props}>
        {tag.label}
      </button>
    </ui.Badge>
  );
});

export function SubmissionTags({ submissionId, tags, canUpdate }: SubmissionTagsProps) {
  const { siteTags } = useLoaderData<SubmissionDetailPageData>();
  const fetcher = useFetcher<{ error?: string; tag?: TagDTO }>();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Which chip the popover is anchored to; `null` anchors it to the add control.
  const [anchorTagId, setAnchorTagId] = useState<string | null>(null);
  const assignedIds = tags.map((tag) => tag.id);
  const pickerBusy = fetcher.state !== 'idle';

  const toggle = (tag: TagDTO) => {
    if (pickerBusy) {
      return;
    }
    if (tag.id === anchorTagId) {
      // Only an assigned tag can be the anchor, so this toggle removes its chip. Drop the
      // anchor now, or re-assigning the tag would drag the open popover back to it.
      setAnchorTagId(null);
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

  const openPickerAt = (tagId: string) => {
    if (pickerBusy) {
      return;
    }
    setAnchorTagId(tagId);
    setPickerOpen(true);
  };

  if (!canUpdate) {
    const addKind = getTagAddControlKind({ permission: 'read', assignedCount: tags.length });
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <ui.Badge key={tag.id} variant="neutral" size="xs" title={tag.name}>
            {tag.label}
          </ui.Badge>
        ))}
        {addKind === 'add-tags' ? <TagAddButton kind="add-tags" disabled /> : null}
      </div>
    );
  }

  const addKind = getTagAddControlKind({ permission: 'update', assignedCount: tags.length });

  return (
    <ui.Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <div className="flex flex-wrap gap-1 items-center w-full min-w-0">
        {tags.map((tag) => {
          const chip = (
            <TagChipButton key={tag.id} tag={tag} onClick={() => openPickerAt(tag.id)} />
          );
          // Anchoring the active chip overrides the trigger; if that chip is removed the
          // anchor unmounts and the popover falls back to the add control.
          return tag.id === anchorTagId ? (
            <ui.PopoverAnchor key={tag.id} asChild>
              {chip}
            </ui.PopoverAnchor>
          ) : (
            chip
          );
        })}
        <ui.PopoverTrigger asChild disabled={pickerBusy}>
          <TagAddButton kind={addKind} onClick={() => setAnchorTagId(null)} />
        </ui.PopoverTrigger>
        <TagPicker
          catalog={siteTags}
          assignedIds={assignedIds}
          disabled={pickerBusy}
          onToggle={toggle}
          onCreate={create}
        />
        {fetcher.data?.error ? (
          <span className="text-sm text-destructive">{fetcher.data.error}</span>
        ) : null}
      </div>
    </ui.Popover>
  );
}
