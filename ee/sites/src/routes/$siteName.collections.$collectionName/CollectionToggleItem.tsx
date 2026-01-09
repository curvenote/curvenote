import { ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import { useState } from 'react';

interface CollectionToggleProps {
  intent: string;
  checked: boolean;
  title: string;
  subtitle?: string;
  yesText?: string;
  noText?: string;
  data?: string;
}

export function CollectionToggleItem({
  intent,
  checked,
  title,
  subtitle,
  yesText,
  noText,
  data,
}: CollectionToggleProps) {
  const fetcher = useFetcher();
  const [switchChecked, setSwitchChecked] = useState(checked);
  const id = `collection-toggle-${intent}${data ? `-${data}` : ''}`;
  const switchColor = 'data-[state=checked]:bg-green-600 dark:data-[state=checked]:bg-green-400';
  return (
    <div className={`w-full`}>
      <fetcher.Form
        method="post"
        className={`flex items-center pl-6 pr-3 py-3`}
        style={{ background: 'transparent' }}
      >
        <input type="hidden" name="intent" value={intent} />
        <ui.Switch
          defaultChecked={checked}
          onCheckedChange={(value) => {
            setSwitchChecked(value);
            fetcher.submit({ intent, value, data: data ?? null }, { method: 'post' });
          }}
          id={id}
          className={`mr-4 h-[1.7rem] w-12 [&_[data-slot=switch-thumb]]:h-6 [&_[data-slot=switch-thumb]]:w-6 cursor-pointer ${switchColor}`}
          aria-label={title}
          tabIndex={0}
        />
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <span className="text-base font-semibold truncate text-foreground" title={title}>
            {title}
          </span>
          {subtitle && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{subtitle}</span>
          )}
          {((switchChecked && yesText) || (!switchChecked && noText)) && (
            <span className="flex-1 ml-4 text-sm text-right truncate text-muted-foreground">
              {switchChecked ? <span>{yesText}</span> : <span>{noText}</span>}
            </span>
          )}
        </div>
      </fetcher.Form>
    </div>
  );
}
