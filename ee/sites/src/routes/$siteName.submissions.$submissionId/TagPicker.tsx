import { useState } from 'react';
import { cn, ui, TAG_LABEL_MAX_LENGTH } from '@curvenote/scms-core';
import { Check, Plus } from 'lucide-react';
import type { SubmissionTagView } from './pendingTagChanges.js';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

type TagPickerCommandProps = {
  catalog: SubmissionTagView[];
  assignedNames: string[];
  isBusy: (name: string) => boolean;
  onToggle: (tag: SubmissionTagView) => void;
  onCreate: (label: string) => void;
};

type TagPickerProps = TagPickerCommandProps & {
  onCloseAutoFocus?: (event: Event) => void;
};

/**
 * Popover content only. The `ui.Popover` roots live in the consumer so the dropdown can
 * anchor to the chip row or to the add control.
 */
export function TagPicker({ onCloseAutoFocus, ...command }: TagPickerProps) {
  return (
    <ui.PopoverContent align="start" className="p-0 w-72" onCloseAutoFocus={onCloseAutoFocus}>
      <TagPickerCommand {...command} />
    </ui.PopoverContent>
  );
}

/**
 * Holds the search query. The consumer remounts `TagPicker` on every open, so the query
 * resets even when the popover's exit animation kept the previous instance alive.
 * A row is disabled while its tag has a change in flight; a pending create is already
 * in `catalog`, so its `Create` row gives way to that disabled row.
 */
function TagPickerCommand({
  catalog,
  assignedNames,
  isBusy,
  onToggle,
  onCreate,
}: TagPickerCommandProps) {
  const [query, setQuery] = useState('');
  const options = filterTagOptions(catalog, query);
  const createOption = getCreateTagOption(catalog, query);

  return (
    <ui.Command shouldFilter={false}>
      <ui.CommandInput
        boxed
        placeholder="Search or create a tag…"
        maxLength={TAG_LABEL_MAX_LENGTH}
        value={query}
        onValueChange={setQuery}
      />
      <ui.CommandList>
        {options.length === 0 && !createOption ? (
          <ui.CommandEmpty>No tags found.</ui.CommandEmpty>
        ) : null}
        <ui.CommandGroup>
          {options.map((tag) => (
            <ui.CommandItem
              key={tag.name}
              value={tag.name}
              disabled={isBusy(tag.name)}
              onSelect={() => onToggle(tag)}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  assignedNames.includes(tag.name) ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              {tag.label}
            </ui.CommandItem>
          ))}
          {createOption ? (
            <ui.CommandItem
              value={`create-${createOption.name}`}
              disabled={isBusy(createOption.name)}
              onSelect={() => onCreate(createOption.label)}
            >
              <Plus className="mr-2 w-4 h-4" aria-hidden />
              {`Create "${createOption.label}"`}
            </ui.CommandItem>
          ) : null}
        </ui.CommandGroup>
      </ui.CommandList>
    </ui.Command>
  );
}
