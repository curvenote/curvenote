import { ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import type { Check, CheckOptionDefinition } from '@curvenote/check-definitions';

interface CheckOptionStringProps {
  option: CheckOptionDefinition;
  check: Check;
}

export function CheckOptionString({ option, check }: CheckOptionStringProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: { message: string } }>();

  const isRequired = option.required !== false;
  const idWord = option.id.charAt(0).toUpperCase() + option.id.slice(1);
  const label = (
    <span>
      <span className="font-bold">{idWord}</span>
      {option.description ? ` – ${option.description}` : ''}
      {isRequired ? ' (required)' : ''}
    </span>
  );

  return (
    <fetcher.Form method="post" className="flex flex-col gap-1">
      <input type="hidden" name="intent" value="update-kind-check-option" />
      <input type="hidden" name="checkId" value={check.id} />
      <input type="hidden" name="optionId" value={option.id} />
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        {label}
        <ui.Input
          type="text"
          name="value"
          id={`${check.id}-${option.id}`}
          defaultValue={check[option.id] ?? option.default}
          required={isRequired}
          className="max-w-xs"
          onBlur={(e) => {
            fetcher.submit(e.currentTarget.form);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              fetcher.submit(e.currentTarget.form);
            }
          }}
        />
      </label>
      {fetcher.data?.error && <ui.ErrorMessage error={fetcher.data.error?.message} />}
    </fetcher.Form>
  );
}
