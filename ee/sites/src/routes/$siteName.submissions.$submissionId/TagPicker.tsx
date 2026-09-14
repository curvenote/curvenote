import { useState, type ReactNode } from 'react';
import type { TagDTO } from '@curvenote/common';
import { cn, ui, TAG_LABEL_MAX_LENGTH } from '@curvenote/scms-core';
import { Check, Plus } from 'lucide-react';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

type TagPickerProps = {
  catalog: TagDTO[];
  assignedIds: string[];
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (tag: TagDTO) => void;
  onCreate: (label: string) => void;
  children: ReactNode;
};

export function TagPicker({
  catalog,
  assignedIds,
  disabled,
  open,
  onOpenChange,
  onToggle,
  onCreate,
  children,
}: TagPickerProps) {
  const [query, setQuery] = useState('');
  const options = filterTagOptions(catalog, query);
  const createOption = getCreateTagOption(catalog, query);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery('');
    }
  };

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
    <ui.Popover open={open} onOpenChange={handleOpenChange}>
      <ui.PopoverTrigger asChild disabled={disabled}>
        {children}
      </ui.PopoverTrigger>
      <ui.PopoverContent align="start" className="p-0 w-72">
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
      </ui.PopoverContent>
    </ui.Popover>
  );
}
