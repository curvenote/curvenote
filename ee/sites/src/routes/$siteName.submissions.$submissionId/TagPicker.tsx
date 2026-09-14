import { useState } from 'react';
import type { TagDTO } from '@curvenote/common';
import { cn, ui, TAG_LABEL_MAX_LENGTH } from '@curvenote/scms-core';
import { Check, Plus } from 'lucide-react';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

type TagPickerCommandProps = {
  catalog: TagDTO[];
  assignedIds: string[];
  disabled?: boolean;
  onToggle: (tag: TagDTO) => void;
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
 */
function TagPickerCommand({
  catalog,
  assignedIds,
  disabled,
  onToggle,
  onCreate,
}: TagPickerCommandProps) {
  const [query, setQuery] = useState('');
  const options = filterTagOptions(catalog, query);
  const createOption = getCreateTagOption(catalog, query);

  const handleToggle = (tag: TagDTO) => {
    if (disabled) {
      return;
    }
    onToggle(tag);
  };

  const handleCreate = (label: string) => {
    if (disabled) {
      return;
    }
    onCreate(label);
  };

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
            <ui.CommandItem key={tag.id} value={tag.id} onSelect={() => handleToggle(tag)}>
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  assignedIds.includes(tag.id) ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              {tag.label}
            </ui.CommandItem>
          ))}
          {createOption ? (
            <ui.CommandItem
              value={`create-${createOption.name}`}
              onSelect={() => handleCreate(createOption.label)}
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
