import { useState } from 'react';
import type { TagDTO } from '@curvenote/common';
import { ui, primitives } from '@curvenote/scms-core';
import { Check, Plus } from 'lucide-react';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

type TagPickerProps = {
  catalog: TagDTO[];
  assignedIds: string[];
  disabled?: boolean;
  onToggle: (tag: TagDTO) => void;
  onCreate: (label: string) => void;
  children: React.ReactNode;
};

export function TagPicker({
  catalog,
  assignedIds,
  disabled,
  onToggle,
  onCreate,
  children,
}: TagPickerProps) {
  const [query, setQuery] = useState('');
  const options = filterTagOptions(catalog, query);
  const createOption = getCreateTagOption(catalog, query);

  return (
    <primitives.PopoverWrapper
      skip={disabled}
      contentAlign="start"
      className="w-72 p-0"
      content={
        <ui.Command shouldFilter={false}>
          <ui.CommandInput placeholder="Search or create a tag…" onValueChange={setQuery} />
          <ui.CommandList>
            {options.length === 0 && !createOption ? (
              <ui.CommandEmpty>No tags found.</ui.CommandEmpty>
            ) : null}
            <ui.CommandGroup>
              {options.map((tag) => (
                <ui.CommandItem key={tag.id} value={tag.id} onSelect={() => onToggle(tag)}>
                  <Check
                    className={
                      assignedIds.includes(tag.id)
                        ? 'mr-2 h-4 w-4 opacity-100'
                        : 'mr-2 h-4 w-4 opacity-0'
                    }
                    aria-hidden
                  />
                  {tag.label}
                </ui.CommandItem>
              ))}
              {createOption ? (
                <ui.CommandItem
                  value={`create-${createOption.name}`}
                  onSelect={() => onCreate(createOption.label)}
                >
                  <Plus className="mr-2 w-4 h-4" aria-hidden />
                  {`Create "${createOption.label}"`}
                </ui.CommandItem>
              ) : null}
            </ui.CommandGroup>
          </ui.CommandList>
        </ui.Command>
      }
    >
      {children}
    </primitives.PopoverWrapper>
  );
}
