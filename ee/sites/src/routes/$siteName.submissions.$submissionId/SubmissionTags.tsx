import { forwardRef, useRef, useState, type ComponentPropsWithoutRef } from 'react';
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

/** Which control the open popover belongs to. `row` is anchored to the whole chip row. */
type PickerMode = 'none' | 'row' | 'plus';

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

function TagChipButton({ tag, ...props }: TagChipProps) {
  return (
    <ui.Badge
      variant="neutral"
      size="xs"
      title={tag.name}
      className="hover:bg-gray-200 dark:hover:bg-stone-600"
      asChild
    >
      <button type="button" {...props}>
        {tag.label}
      </button>
    </ui.Badge>
  );
}

export function SubmissionTags({ submissionId, tags, canUpdate }: SubmissionTagsProps) {
  const { siteTags } = useLoaderData<SubmissionDetailPageData>();
  const fetcher = useFetcher<{ error?: string; tag?: TagDTO }>();
  const [mode, setMode] = useState<PickerMode>('none');
  // Bumped on every closed → open transition so the command remounts and the query resets,
  // even when the exit animation kept the previous instance alive.
  const [session, setSession] = useState(0);
  const lastOpenerRef = useRef<HTMLButtonElement | null>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
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

  const openPicker = (next: 'row' | 'plus', opener: HTMLButtonElement | null) => {
    if (pickerBusy) {
      return;
    }
    lastOpenerRef.current = opener;
    setSession((previous) => previous + 1);
    setMode(next);
  };

  // Dismissing a popover and opening the other one happen in the same batch: the outside
  // pointerdown closes first, then the click opens. Close only from the mode that is
  // actually open so the order of the two updates cannot matter.
  const handleRowOpenChange = (open: boolean) => {
    if (!open) {
      setMode((current) => (current === 'row' ? 'none' : current));
    }
  };

  const handlePlusOpenChange = (open: boolean) => {
    if (open) {
      openPicker('plus', plusRef.current);
      return;
    }
    setMode((current) => (current === 'plus' ? 'none' : current));
  };

  // Radix always sends focus back to the trigger, and the row popover has none. Send it to
  // whatever opened the picker, falling back to the add control when that chip is gone.
  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    const opener = lastOpenerRef.current;
    const target = opener?.isConnected && !opener.disabled ? opener : plusRef.current;
    target?.focus();
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

  const picker = (
    <TagPicker
      key={session}
      catalog={siteTags}
      assignedIds={assignedIds}
      disabled={pickerBusy}
      onToggle={toggle}
      onCreate={create}
      onCloseAutoFocus={handleCloseAutoFocus}
    />
  );

  // Two popover roots so neither ever mounts or unmounts an anchor: the row root is
  // permanently anchored to the chip row, the add root permanently anchored to its trigger.
  // Radix reads `hasCustomAnchor` from state set in an effect, so a topology that changes on
  // click would position the first frame against the wrong element.
  return (
    <ui.Popover open={mode === 'row'} onOpenChange={handleRowOpenChange}>
      <ui.PopoverAnchor asChild>
        <div className="flex flex-wrap gap-1 items-center w-full min-w-0">
          {tags.map((tag) => (
            <TagChipButton
              key={tag.id}
              tag={tag}
              aria-haspopup="dialog"
              onClick={(event) => openPicker('row', event.currentTarget)}
            />
          ))}
          <ui.Popover open={mode === 'plus'} onOpenChange={handlePlusOpenChange}>
            <ui.PopoverTrigger asChild disabled={pickerBusy}>
              <TagAddButton ref={plusRef} kind={addKind} />
            </ui.PopoverTrigger>
            {picker}
          </ui.Popover>
          {fetcher.data?.error ? (
            <span className="text-sm text-destructive">{fetcher.data.error}</span>
          ) : null}
        </div>
      </ui.PopoverAnchor>
      {picker}
    </ui.Popover>
  );
}
