import { ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import { useState } from 'react';

export function DefaultKindCheckbox({ kind }: { kind: { default: boolean; name: string } }) {
  const fetcher = useFetcher<{ success?: boolean; error?: { message: string } }>();

  const [checked, setChecked] = useState(kind.default);

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-foreground">
        <ui.Checkbox
          name="value"
          aria-label="Toggle kind as default"
          id={`${kind.name}-default`}
          defaultChecked={checked}
          onCheckedChange={(value) => {
            setChecked(!!value);
            const formData = new FormData();
            formData.append('intent', 'update-kind-default');
            formData.append('value', value ? 'true' : 'false');
            fetcher.submit(formData, { method: 'post' });
          }}
          className="mr-2"
        />
        Default
      </label>
      {fetcher.data?.error && <ui.ErrorMessage error={fetcher.data.error?.message} />}
    </div>
  );
}
