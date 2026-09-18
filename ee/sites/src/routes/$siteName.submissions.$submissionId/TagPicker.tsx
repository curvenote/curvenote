import { useState } from 'react';
import { cn, ui, TAG_LABEL_MAX_LENGTH } from '@curvenote/scms-core';
import { Check, Plus } from 'lucide-react';
import type { DisplayTagDTO } from './pendingTagChanges.js';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

type TagPickerCommandProps = {
  catalog: DisplayTagDTO[];
  assignedNames: string[];
  isBusy: (name: string) => boolean;
  onToggle: (tag: DisplayTagDTO) => void;
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

  // Clearing the query after a pick leaves the input ready for the next tag and
  // brings the rest of the catalog back into view, including the tag just picked.
  const handleToggle = (tag: DisplayTagDTO) => {
    onToggle(tag);
    setQuery('');
  };

  const handleCreate = (label: string) => {
    onCreate(label);
    setQuery('');
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
            <ui.CommandItem
              key={tag.name}
              value={tag.name}
              disabled={isBusy(tag.name)}
              onSelect={() => handleToggle(tag)}
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
