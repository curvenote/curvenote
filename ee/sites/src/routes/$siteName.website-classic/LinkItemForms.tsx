import { useFetcher } from 'react-router';
import { MoveUp, MoveDown, Trash2 } from 'lucide-react';
import { ui, primitives } from '@curvenote/scms-core';
import { INTENTS } from './types.js';

export function EditLinkItemForm({
  item,
  disabled,
}: {
  item: { title: string; url?: string };
  disabled: boolean;
}) {
  const fetcher = useFetcher();

  const error = (fetcher.data as any)?.error;

  return (
    <fetcher.Form method="POST">
      {error && <div className="py-3 text-red-500">Error: {error}</div>}
      <div
        key={`${item.title.replace(/\s/g, '').toLowerCase()}-${item.url}`}
        className="flex items-end"
      >
        <input type="hidden" name="old_url" value={item.url} />
        <div className="w-1/3 mr-4">
          <primitives.TextField
            className="w-full"
            disabled={disabled || fetcher.state !== 'idle'}
            required
            id={`nav.${item.url}.title`}
            name={`nav.${item.url}.title`}
            defaultValue={item.title}
            label="Title"
          />
        </div>
        <div className="w-1/3 mr-4">
          <primitives.TextField
            disabled={disabled || fetcher.state !== 'idle'}
            required
            className="w-full"
            id={`nav.${item.url}.url`}
            defaultValue={item.url}
            name={`nav.${item.url}.url`}
            label="Url"
          />
        </div>
        <ui.StatefulButton
          type="submit"
          size="sm"
          variant="default"
          className="mr-2"
          name="intent"
          value={INTENTS.navUpdate}
          busy={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'update'}
          overlayBusy
          disabled={disabled}
        >
          Update
        </ui.StatefulButton>
        <ui.StatefulButton
          type="submit"
          size="sm"
          variant="default"
          className="mr-2"
          name="intent"
          value={INTENTS.navMoveUp}
          busy={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'move-up'}
          overlayBusy
          disabled={disabled}
        >
          <MoveUp className="w-3 h-3" />
        </ui.StatefulButton>
        <ui.StatefulButton
          type="submit"
          size="sm"
          variant="default"
          className="mr-2"
          name="intent"
          value={INTENTS.navMoveDown}
          busy={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'move-down'}
          overlayBusy
          disabled={disabled}
        >
          <MoveDown className="w-3 h-3" />
        </ui.StatefulButton>
        <ui.StatefulButton
          type="submit"
          size="sm"
          variant="destructive"
          className="mr-2"
          name="intent"
          value={INTENTS.navDelete}
          busy={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'delete'}
          overlayBusy
          disabled={disabled}
        >
          <Trash2 className="w-3 h-3" />
        </ui.StatefulButton>
      </div>
    </fetcher.Form>
  );
}

export function AddLinkItemForm({ disabled }: { disabled: boolean }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="POST">
      <div key={`add-nav-item`} className="flex items-end gap-4">
        <div className="w-1/3">
          <primitives.TextField
            className="w-full"
            disabled={disabled || fetcher.state !== 'idle'}
            required
            id={`nav.new.title`}
            name={`nav.new.title`}
            label="Title"
            placeholder='e.g. "About"'
          />
        </div>
        <div className="w-1/3">
          <primitives.TextField
            className="w-full"
            disabled={disabled || fetcher.state !== 'idle'}
            required
            id={`nav.new.url`}
            name={`nav.new.url`}
            label="Url"
            placeholder="e.g. /about"
          />
        </div>
        <ui.StatefulButton
          type="submit"
          size="sm"
          variant="default"
          className=""
          name="intent"
          value={INTENTS.navAdd}
          busy={fetcher.state === 'submitting'}
          overlayBusy
          disabled={disabled}
        >
          Add
        </ui.StatefulButton>
      </div>
    </fetcher.Form>
  );
}
