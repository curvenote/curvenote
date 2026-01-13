import { useState } from 'react';
import { useFetcher } from 'react-router';
import { ui, primitives, useExpandableForm, cn } from '@curvenote/scms-core';
import { PlusCircle } from 'lucide-react';
import type { FormError } from '@curvenote/scms-core';

interface AddDomainFormProps {
  siteName: string;
}

export function AddDomainForm({ siteName }: AddDomainFormProps) {
  const [isDefault, setIsDefault] = useState(false);
  const fetcher = useFetcher<{ error?: FormError }>();
  const { isExpanded, isExiting, expand, handleCancel, formRef, onSubmit } = useExpandableForm(
    fetcher,
    {
      animationDuration: 200,
    },
  );
  const isSubmitting = fetcher.state === 'submitting';

  return (
    <div className="w-full max-w-md">
      {!isExpanded ? (
        <ui.Button variant="default" onClick={expand} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Add New Domain
        </ui.Button>
      ) : (
        <primitives.Card
          className={cn(
            'duration-200',
            !isExiting ? 'animate-in slide-in-from-top-2' : 'animate-out slide-out-to-top-2',
          )}
        >
          <fetcher.Form
            ref={formRef}
            method="post"
            className="flex flex-col w-full gap-4"
            onSubmit={onSubmit}
          >
            <input type="hidden" name="intent" value="create" />
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-md">Add New Domain</h3>
            </div>
            <div>
              <ui.TextField
                id="hostname"
                name="hostname"
                label="Domain Name"
                placeholder="Enter hostname e.g. example.com"
                required
                autoFocus
                error={fetcher.data?.error?.message}
              />
            </div>
            <div className="flex items-center gap-2">
              <ui.Checkbox
                id="is_default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked as boolean)}
                className="cursor-pointer"
              />
              <label
                htmlFor="is_default"
                className="text-sm cursor-pointer text-stone-600 dark:text-stone-400"
              >
                Make this the default domain
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <input type="hidden" name="site_name" value={siteName} />
              <input type="hidden" name="is_default" value={isDefault.toString()} />
              <ui.Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </ui.Button>
              <ui.StatefulButton type="submit" overlayBusy busy={isSubmitting}>
                Save
              </ui.StatefulButton>
            </div>
          </fetcher.Form>
        </primitives.Card>
      )}
    </div>
  );
}
