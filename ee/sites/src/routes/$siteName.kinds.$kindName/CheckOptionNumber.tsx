import { ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import type { Check, CheckOptionDefinition } from '@curvenote/check-definitions';
// import { useLoaderData } from '@remix-run/react'; // For optimistic UI, uncomment if needed

interface CheckOptionNumberProps {
  option: CheckOptionDefinition;
  check: Check;
}

export function CheckOptionNumber({ option, check }: CheckOptionNumberProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: { message: string } }>();
  // const loaderData = useLoaderData(); // For optimistic UI, uncomment if needed

  // Optimistic UI: use fetcher.formData if present
  let value = check[option.id] ?? option.default ?? '';
  if (fetcher.formData) {
    const formValue = fetcher.formData.get('value');
    if (formValue !== null) value = formValue;
  }

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
          type="number"
          name="value"
          id={`${check.id}-${option.id}`}
          defaultValue={value}
          min={option.min}
          max={option.max}
          step={option.integer ? 1 : undefined}
          pattern={option.integer ? '\\d*' : undefined}
          inputMode={option.integer ? 'numeric' : undefined}
          required={isRequired}
          className="max-w-xs"
          onBlur={(e) => {
            fetcher.submit(e.currentTarget.form);
          }}
          onKeyDown={(e) => {
            if (option.integer && (e.key === '.' || e.key === 'e')) e.preventDefault();
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
