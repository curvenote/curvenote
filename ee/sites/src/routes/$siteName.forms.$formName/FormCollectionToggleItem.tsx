import { ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import { useState, useEffect } from 'react';

interface FormCollectionToggleProps {
  intent: string;
  checked: boolean;
  title: string;
  disabled?: boolean;
  disabledMessage?: string;
  data?: string;
  onToggle?: (value: boolean) => void;
}

export function FormCollectionToggleItem({
  intent,
  checked,
  title,
  disabled = false,
  disabledMessage,
  data,
  onToggle,
}: FormCollectionToggleProps) {
  const fetcher = useFetcher();
  const [switchChecked, setSwitchChecked] = useState(checked);
  const id = `form-collection-toggle-${intent}${data ? `-${data}` : ''}`;
  const switchColor = 'data-[state=checked]:bg-green-600 dark:data-[state=checked]:bg-green-400';

  // Sync internal state with prop changes
  useEffect(() => {
    setSwitchChecked(checked);
  }, [checked]);

  const handleToggle = (value: boolean) => {
    if (disabled) return;
    setSwitchChecked(value);
    if (onToggle) {
      onToggle(value);
    } else {
      fetcher.submit({ intent, value, data: data ?? null }, { method: 'post' });
    }
  };

  return (
    <div className={`w-full ${disabled ? 'opacity-50' : ''}`}>
      <fetcher.Form
        method="post"
        className={`flex items-center pl-6 pr-3 py-3`}
        style={{ background: 'transparent' }}
      >
        <input type="hidden" name="intent" value={intent} />
        <ui.Switch
          checked={switchChecked}
          onCheckedChange={handleToggle}
          id={id}
          disabled={disabled}
          className={`mr-4 h-[1.7rem] w-12 [&_[data-slot=switch-thumb]]:h-6 [&_[data-slot=switch-thumb]]:w-6 ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${switchColor}`}
          aria-label={title}
          tabIndex={disabled ? -1 : 0}
        />
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <span
            className={`text-base font-semibold truncate ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}
            title={title}
          >
            {title}
          </span>
          {disabled && disabledMessage && (
            <span className="ml-2 text-sm italic font-normal text-muted-foreground">
              {disabledMessage}
            </span>
          )}
        </div>
      </fetcher.Form>
    </div>
  );
}
