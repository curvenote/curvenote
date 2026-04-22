import { useEffect, type ReactNode } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { Route } from './+types/route';
import type { WorkVersionCheckName } from '@curvenote/scms-server';

interface CheckOptionItemProps {
  intent: 'toggle-check';
  name: WorkVersionCheckName;
  label: ReactNode;
  description: string;
  checked: boolean;
  disabled?: boolean;
}

export function CheckOptionItem({
  intent,
  name,
  label,
  description,
  checked,
  disabled = false,
}: CheckOptionItemProps) {
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();

  // Show toast when action returns an error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) {
      ui.toastError((fetcher.data as { error: { message: string } }).error.message);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="flex items-start space-x-3">
      <ui.Checkbox
        id={name}
        name={name}
        defaultChecked={checked}
        disabled={disabled}
        onCheckedChange={(isChecked) => {
          const formData = new FormData();
          formData.append('intent', intent);
          formData.append('checkName', name);
          formData.append('checked', isChecked.toString());
          fetcher.submit(formData, { method: 'post' });
        }}
      />
      <label
        htmlFor={name}
        className={`flex flex-col space-y-1 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <span className="text-sm font-medium leading-none">
          {label}
        </span>
        <span className="text-sm text-muted-foreground">
          {description}
        </span>
      </label>
    </div>
  );
}
