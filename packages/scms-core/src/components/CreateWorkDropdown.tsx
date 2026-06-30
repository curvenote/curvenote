import { useState } from 'react';
import { ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { WorkCreateOption } from '../modules/extensions/types.js';
import { Button } from './ui/button.js';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './ui/menu.js';
import { cn } from '../utils/cn.js';

export interface CreateWorkDropdownProps {
  options: WorkCreateOption[];
  /** Primary button label when multiple options exist (e.g. "Create new work"). */
  triggerLabel: string;
  disabled?: boolean;
  className?: string;
  onDisabledClick?: () => void;
}

export function CreateWorkDropdown({
  options,
  triggerLabel,
  disabled = false,
  className,
  onDisabledClick,
}: CreateWorkDropdownProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSelect = (option: WorkCreateOption) => {
    setOpen(false);
    navigate(option.startPath);
  };

  if (disabled) {
    return (
      <Button
        type="button"
        size="lg"
        variant="default"
        className={cn('inline-flex gap-2 items-center', className)}
        onClick={onDisabledClick}
      >
        <PlusCircle className="w-4 h-4" />
        {triggerLabel}
      </Button>
    );
  }

  if (options.length <= 1) {
    const only = options[0];
    return (
      <Button
        type="button"
        size="lg"
        variant="default"
        className={cn('inline-flex gap-2 items-center', className)}
        onClick={() => (only ? navigate(only.startPath) : undefined)}
      >
        <PlusCircle className="w-4 h-4" />
        {triggerLabel}
      </Button>
    );
  }

  const primary = options[0];

  return (
    <div className={cn('flex rounded-md shadow-sm', className)} role="group">
      <Button
        type="button"
        size="lg"
        variant="default"
        className="inline-flex flex-1 gap-2 items-center min-w-0 rounded-r-none border-r border-white/30"
        onClick={() => navigate(primary.startPath)}
      >
        <PlusCircle className="w-4 h-4 shrink-0" />
        {triggerLabel}
      </Button>
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger asChild>
          <Button
            type="button"
            size="lg"
            variant="default"
            className={cn(
              'px-2 rounded-l-none border-l-0 border-white/30 transition-colors',
              open && 'bg-primary/60',
            )}
            aria-label="Choose work type to create"
          >
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </MenuTrigger>
        <MenuContent className="min-w-[14rem] p-1" align="end" sideOffset={4}>
          {options.map((option) => (
            <MenuItem
              key={option.id}
              className="flex flex-col gap-0.5 items-start px-3 py-2 text-sm"
              onSelect={(e) => {
                e.preventDefault();
                handleSelect(option);
              }}
            >
              <span className="font-medium">{option.label}</span>
              {option.description ? (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
