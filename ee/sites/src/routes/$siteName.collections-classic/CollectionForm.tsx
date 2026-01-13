import { useFetcher } from 'react-router';
import { ui, primitives } from '@curvenote/scms-core';
import { useEffect, useRef, useState } from 'react';
import type { SiteDTO } from '@curvenote/common';
import type { CollectionsDBO, KindsDBO } from './db.server.js';

export function CollectionForm({
  site,
  formAction,
  initialState,
  items,
  kinds,
  onReset,
  onSuccess,
}: {
  site: SiteDTO;
  formAction: string;
  initialState?: Partial<CollectionsDBO[0]>;
  items: CollectionsDBO;
  kinds: KindsDBO;
  onReset?: () => void;
  onSuccess?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<{ ok: boolean; error?: string | string[] }>();
  const [dirtyName, setDirtyName] = useState(false);
  const [dirtySlug, setDirtySlug] = useState(false);
  const [name, setName] = useState(initialState?.name);
  const [slug, setSlug] = useState(initialState?.slug);

  useEffect(() => {
    setDirtyName(formAction === 'collection-edit');
    setDirtySlug(formAction === 'collection-edit');
  }, [formAction]);

  useEffect(() => {
    if (initialState?.name) setName(initialState?.name);
    if (initialState?.slug) setSlug(initialState?.slug);
  }, [initialState]);

  useEffect(() => {
    if (fetcher.data?.ok) {
      form.current?.reset();
      setName('');
      setSlug('');
      setDirtyName(false);
      setDirtySlug(false);
      onSuccess?.();
    }
  }, [fetcher.data?.ok]);

  useEffect(() => {
    form.current?.reset();
  }, [initialState]);

  return (
    <fetcher.Form ref={form} className="py-4 space-y-6" method="POST">
      <div className="flex space-x-4 space-y-4">
        <div className="max-w-lg space-y-4 grow">
          <input type="hidden" name="formAction" value={formAction} />
          <input type="hidden" name="id" value={initialState?.id} />
          <primitives.TextField
            id="create.title"
            name="title"
            label="Title"
            placeholder="Articles 2024"
            required
            defaultValue={(initialState?.content as any)?.title}
            onChange={(e) => {
              const value = e.target.value.trim().toLowerCase().replace(/\s+/g, '-');
              if (!dirtyName) setName(value);
              if (!dirtySlug) setSlug(value);
            }}
          />
          <primitives.TextField
            id="create.name"
            name="name"
            label="Name"
            placeholder="articles-2024"
            required
            value={name}
            onChange={(e) => {
              if (!dirtyName) setDirtyName(true);
              setName(e.target.value);
            }}
          />
          <primitives.TextField
            id="create.slug"
            name="slug"
            label="Slug"
            placeholder="2024"
            value={slug}
            onChange={(e) => {
              if (!dirtySlug) setDirtySlug(true);
              setSlug(e.target.value);
            }}
          />
          <primitives.TextField
            id="create.description"
            name="description"
            label="Description"
            defaultValue={(initialState?.content as any)?.description}
          />
        </div>
        <div className="max-w-lg space-y-4 grow">
          <div className="p-4 rounded bg-stone-100 dark:bg-stone-800 border-[1px] border-slate-200 dark:border-slate-700">
            <h4 className="mb-2 font-semibold">Workflow</h4>
            <select
              className="bg-stone-50 dark:bg-stone-800"
              id="create.workflow"
              name="workflow"
              defaultValue={site.default_workflow}
            >
              {site.private ? (
                <option value="PRIVATE">Private</option>
              ) : (
                <option value="SIMPLE">Simple</option>
              )}
              {/* <option value="OPEN_REVIEW">Open Review</option>
              <option value="CLOSED_REVIEW">Closed Review</option> */}
            </select>
            <div className="mt-2 text-xs">
              The default workflow for this site is {site.default_workflow}.
            </div>
          </div>
          <div className="flex p-4 rounded bg-stone-100 dark:bg-stone-800 border-[1px] border-slate-200 dark:border-slate-700 space-x-2">
            <primitives.Checkbox
              id="create.default"
              name="default"
              value="default"
              label="Default"
              defaultChecked={initialState?.default ?? true}
            />
            <primitives.Checkbox
              id="create.open"
              name="open"
              value="open"
              label="Open"
              defaultChecked={initialState?.open ?? true}
            />
          </div>
          <div className="p-4 rounded bg-stone-100 dark:bg-stone-800 border-[1px] border-slate-200 dark:border-slate-700">
            <h4 className="mb-2 font-semibold dark:text-white">Parent?</h4>
            <select
              id="create.parent"
              name="parent"
              defaultValue={
                items.find((item) => item.id === initialState?.parent_id)?.slug ?? 'none'
              }
              className="bg-stone-50 dark:bg-stone-800"
            >
              <option value="none">None</option>
              {items.map((c) => (
                <option key={`select-parent-${c.id}`} value={c.id}>
                  {c.slug}
                </option>
              ))}
            </select>
          </div>
          <div className="p-4 space-y-4 rounded bg-stone-100 dark:bg-stone-800 border-[1px] border-slate-200 dark:border-slate-700">
            <h4 className="mb-2 font-semibold dark:text-white">Submission Kinds</h4>
            {kinds.map((k) => (
              <primitives.Checkbox
                key={`kind-${k.id}`}
                id={`check-kind-${k.id}`}
                name={`check-kind-${k.id}`}
                label={k.name}
                defaultChecked={
                  initialState?.kindsInCollection?.some((sk) => sk.kind.id === k.id) ?? true
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-x-2">
        <ui.StatefulButton
          variant="outline"
          disabled={fetcher.state !== 'idle'}
          type="reset"
          onClick={() => {
            form.current?.reset();
            setDirtyName(false);
            setName('');
            setSlug('');
            if (fetcher.data?.error) fetcher.data.error = undefined;
            onReset?.();
          }}
        >
          Reset
        </ui.StatefulButton>
        <ui.StatefulButton
          disabled={fetcher.state !== 'idle' && fetcher.state !== 'submitting'}
          busy={fetcher.state === 'submitting'}
          overlayBusy
          type="submit"
        >
          {formAction === 'collection-edit' ? 'Save' : 'Create'}
        </ui.StatefulButton>
      </div>
      {fetcher.data?.error && (
        <div className="text-red-500 ">
          {Array.isArray(fetcher.data.error) ? (
            fetcher.data.error.map((e: any, i: number) => (
              <div key={`error-${e.path.join('.')}-${i}`}>
                {e.code} {e.path.join('.')} expected: {e.expected} received: {e.received}
              </div>
            ))
          ) : (
            <span>{fetcher.data.error}</span>
          )}
        </div>
      )}
    </fetcher.Form>
  );
}
