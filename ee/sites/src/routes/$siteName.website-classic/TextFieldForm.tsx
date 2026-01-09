import { useFetcher } from 'react-router';
import { useRef } from 'react';
import { primitives } from '@curvenote/scms-core';

export function TextFieldForm({
  id,
  name,
  label,
  intent,
  className,
  disabled,
  required,
  value,
  fetcherKey,
}: primitives.TextFieldProps & { fetcherKey?: string; intent: string }) {
  const fetcher = useFetcher({ key: fetcherKey });
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <fetcher.Form method="POST">
      <input type="hidden" name="intent" value={intent} />
      <primitives.TextField
        ref={inputRef}
        className={className}
        disabled={disabled || fetcher.state !== 'idle'}
        required={required}
        id={id}
        name={name}
        defaultValue={value}
        label={label}
        onBlur={(event) => {
          if (inputRef.current?.value !== value) {
            fetcher.submit(event.target.form);
          }
        }}
        status={fetcher.state === 'submitting' ? 'saving...' : undefined}
      />
    </fetcher.Form>
  );
}
