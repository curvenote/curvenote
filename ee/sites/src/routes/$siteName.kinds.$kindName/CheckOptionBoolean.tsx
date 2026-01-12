import { ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import type { Check, CheckOptionDefinition } from '@curvenote/check-definitions';
import { useState } from 'react';

interface CheckOptionBooleanProps {
  option: CheckOptionDefinition;
  check: Check;
}

export function CheckOptionBoolean({ option, check }: CheckOptionBooleanProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: { message: string } }>();

  const [checked, setChecked] = useState(!!(check[option.id] ?? option.default));

  const idWord = option.id.charAt(0).toUpperCase() + option.id.slice(1);
  const label = (
    <span>
      <span className="font-bold">{idWord}</span>
      {option.description ? ` – ${option.description}` : ''}
    </span>
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ui.Checkbox
          name="value"
          id={`${check.id}-${option.id}`}
          defaultChecked={checked}
          onCheckedChange={(value) => {
            setChecked(!!value);
            const formData = new FormData();
            formData.append('intent', 'update-kind-check-option');
            formData.append('checkId', check.id);
            formData.append('optionId', option.id);
            formData.append('value', value ? 'true' : 'false');

            fetcher.submit(formData, { method: 'post' });
          }}
          className="mr-2"
        />
        {label}
      </label>
      {fetcher.data?.error && <ui.ErrorMessage error={fetcher.data.error?.message} />}
    </div>
  );
}
