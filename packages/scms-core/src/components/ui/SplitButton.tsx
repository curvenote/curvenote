import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatefulButton } from './StatefulButton.js';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './menu.js';
import { Button } from './button.js';
import { cn } from '../../utils/cn.js';

export interface SplitButtonOption {
  label: string;
  value: string;
}

export interface SplitButtonProps {
  /** Label for the primary (default) action */
  primaryLabel: string;
  /** Value passed to onPrimaryAction (e.g. transition name) */
  primaryValue: string;
  /** Called when the primary action is triggered */
  onPrimaryAction: (value: string) => void;
  /** Additional actions shown in the dropdown (excluding the primary) */
  otherActions: SplitButtonOption[];
  /** Called when a dropdown option is selected; close the menu after */
  onOptionSelect: (value: string) => void;
  disabled?: boolean;
  busy?: boolean;
  /** Optional size for the button and dropdown menu (default: default) */
  size?: 'xs' | 'sm' | 'default';
  /** Optional class for the root container */
  className?: string;
}

const menuSizeClasses = {
  content: {
    xs: 'min-w-[8rem] p-0.5',
    sm: 'min-w-[9rem] p-1',
    default: 'min-w-[10rem] p-1',
  },
  item: {
    xs: 'px-2 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    default: 'px-4 py-2 text-base',
  },
  chevron: {
    xs: 'h-4 w-4',
    sm: 'h-5 w-5',
    default: 'h-5 w-5',
  },
} as const;

/**
 * A split button: primary action as the main button, with a dropdown for
 * additional actions. Uses Radix UI dropdown for keyboard accessibility.
 * When otherActions is empty, renders a single primary button (no split).
 */
export function SplitButton({
  primaryLabel,
  primaryValue,
  onPrimaryAction,
  otherActions,
  onOptionSelect,
  disabled = false,
  busy = false,
  size = 'default',
  className,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);

  const handleOptionClick = (value: string) => {
    onOptionSelect(value);
    setOpen(false);
  };

  const hasDropdown = otherActions.length > 0;

  if (!hasDropdown) {
    return (
      <StatefulButton
        variant="default"
        size={size}
        busy={busy}
        disabled={disabled}
        overlayBusy
        onClick={() => onPrimaryAction(primaryValue)}
        className={cn('w-full', className)}
      >
        {primaryLabel}
      </StatefulButton>
    );
  }

  return (
    <div className={cn('flex w-full rounded-md shadow-sm', className)} role="group">
      {/* Primary action – left part of split */}
      <StatefulButton
        variant="default"
        size={size}
        busy={busy}
        disabled={disabled}
        overlayBusy
        onClick={() => onPrimaryAction(primaryValue)}
        className="flex-1 min-w-0 rounded-r-none border-r border-white/30"
      >
        {primaryLabel}
      </StatefulButton>

      {/* Dropdown trigger – right part with chevron */}
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger asChild>
          <Button
            type="button"
            variant="default"
            size={size}
            disabled={disabled || busy}
            className={cn(
              'px-2 rounded-l-none border-l-0 border-white/30 transition-colors',
              open && 'bg-primary/60',
            )}
            aria-label="More actions"
          >
            {open ? (
              <ChevronUp className={menuSizeClasses.chevron[size]} />
            ) : (
              <ChevronDown className={menuSizeClasses.chevron[size]} />
            )}
          </Button>
        </MenuTrigger>
        <MenuContent className={menuSizeClasses.content[size]} align="end" sideOffset={4}>
          {otherActions.map((action) => (
            <MenuItem
              key={action.value}
              className={menuSizeClasses.item[size]}
              onSelect={(e) => {
                e.preventDefault();
                handleOptionClick(action.value);
              }}
            >
              {action.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
