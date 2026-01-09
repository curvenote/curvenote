import { withAppSiteContext } from '@curvenote/scms-server';
import {
  PageFrame,
  EmptyMessage,
  ui,
  primitives,
  SlugLike,
  httpError,
  site as siteScopes,
  clientCheckSiteScopes,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useFetcher, data } from 'react-router';
import { SquareCheckBig, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import type { DBO } from './db.server.js';
import { dbListSubmissionKinds } from './db.server.js';
import { $actionKindCreate, $actionKindEdit, $actionKindDelete } from './actionHelpers.server.js';
import type { SiteDTO } from '@curvenote/common';

interface LoaderData {
  scopes: string[];
  items: DBO;
  site: SiteDTO;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.kinds.read, siteScopes.kinds.list], {
    redirectTo: '/app',
    redirect: true,
  });
  const items = await dbListSubmissionKinds(ctx.site.id);
  return { scopes: ctx.scopes, items, site: ctx.siteDTO };
}

function CheckInfo({ check: c }: { check: { id: string; optional?: true } & Record<string, any> }) {
  return (
    <span>
      {c.id +
        `[${Object.entries(c)
          .filter(([k]) => k !== 'id')
          .flatMap(([k, v]) => `${k}:${v}`)}]`}
    </span>
  );
}

function FormErrorReport({ error }: { error?: any[] | string }) {
  if (!error) return null;
  return (
    <div className="text-red-500">
      {Array.isArray(error) ? (
        error.map((e: any, i: number) => (
          <div key={`error-${e.path.join('.')}-${i}`}>
            {e.code} {e.path.join('.')} expected: {e.expected} received: {e.received}
          </div>
        ))
      ) : (
        <span>{error}</span>
      )}
    </div>
  );
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    siteScopes.kinds.create,
    siteScopes.kinds.update,
    siteScopes.kinds.delete,
  ]);

  const { siteName } = args.params;
  if (!siteName) throw httpError(400, 'Missing siteName');

  const formData = await args.request.formData();

  const formAction = formData.get('formAction');
  if (!formAction) return data({ error: 'Missing formAction' }, { status: 400 });
  if (formAction === 'kind-create') {
    return $actionKindCreate(ctx, formData);
  } else if (formAction === 'kind-edit') {
    return $actionKindEdit(ctx, formData);
  } else if (formAction === 'kind-delete') {
    return $actionKindDelete(ctx, formData);
  }

  return null;
}

function SubmissionKindForm({
  formAction,
  initialState,
  onReset,
  onSuccess,
}: {
  formAction: string;
  initialState: Partial<DBO[0]>;
  onReset?: () => void;
  onSuccess?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher();
  const [dirtyName, setDirtyName] = useState(formAction === 'kind-edit');
  const [name, setName] = useState(initialState.name);

  useEffect(() => {
    setDirtyName(formAction === 'kind-edit');
  }, [formAction]);

  useEffect(() => {
    if (initialState?.name) setName(initialState?.name);
  }, [initialState]);

  useEffect(() => {
    if (fetcher.data?.ok) {
      form.current?.reset();
      setName('');
      onSuccess?.();
    }
  }, [fetcher.data]);

  return (
    <fetcher.Form
      key={`${formAction}-${initialState.id}`}
      ref={form}
      className="py-4 space-y-6"
      method="POST"
    >
      <div className="flex space-x-4 space-y-4">
        <div className="max-w-lg space-y-4 grow">
          <input type="hidden" name="formAction" value={formAction} />
          <input type="hidden" name="id" value={initialState.id} />
          <primitives.TextField
            id="create.title"
            name="title"
            label="Title"
            placeholder="Research Article"
            required
            defaultValue={(initialState.content as { title: string })?.title as string}
            onChange={(e) => {
              const value = e.target.value
                .trim()
                .toLowerCase()
                .replace(/[\s.]+/g, '-');
              if (!dirtyName) setName(value);
            }}
          />
          <primitives.TextField
            id="create.name"
            name="name"
            label="Name"
            placeholder="research-article"
            required
            value={name}
            onChange={(e) => {
              if (!dirtyName) setDirtyName(true);
              setName(e.target.value);
            }}
          />
          <primitives.TextField
            id="create.description"
            name="description"
            label="Description"
            defaultValue={(initialState.content as any)?.description}
          />
          <div className="flex p-4 rounded bg-stone-100 dark:bg-stone-800 border-[1px] border-slate-200 dark:border-slate-700 space-x-2">
            <primitives.Checkbox
              id="create.default"
              name="default"
              value="default"
              label="Default"
              title={
                initialState.default
                  ? 'There must always be a default submission kind. Set another kind to default to remove this status.'
                  : undefined
              }
              disabled={initialState.default}
              defaultChecked={initialState.default ?? true}
            />
          </div>
        </div>
      </div>
      <div className="space-x-2">
        <ui.StatefulButton
          variant="outline"
          disabled={fetcher.state !== 'idle'}
          type="reset"
          onClick={() => {
            setDirtyName(false);
            form.current?.reset();
            setName('');
            fetcher.data.error = undefined;
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
          {formAction === 'kind-create' ? 'Create' : 'Save'}
        </ui.StatefulButton>
      </div>
      <FormErrorReport error={fetcher.data?.error} />
    </fetcher.Form>
  );
}

export default function ({ loaderData }: { loaderData: LoaderData }) {
  const { scopes, site, items } = loaderData;
  const [editInitialState, setEditInitialState] = useState<Partial<DBO[0]> | null>(null);
  const fetcher = useFetcher();

  const canRead = clientCheckSiteScopes(
    scopes,
    [siteScopes.kinds.read, siteScopes.kinds.list],
    site.name,
  );
  const canCreate = clientCheckSiteScopes(scopes, [siteScopes.kinds.create], site.name);
  const canEdit = clientCheckSiteScopes(scopes, [siteScopes.kinds.update], site.name);
  const canDelete = clientCheckSiteScopes(scopes, [siteScopes.kinds.delete], site.name);

  function handleStartEditing(k: DBO[0]) {
    setEditInitialState(k);
  }

  function handleDelete(k: DBO[0]) {
    if (!confirm(`Are you sure you want to delete the kind "${k.name}"?`)) return;
    if (k.id === editInitialState?.id) setEditInitialState(null);
    fetcher.submit(
      {
        formAction: 'kind-delete',
        id: k.id,
      },
      {
        method: 'POST',
      },
    );
  }

  if (!canRead) return null;

  return (
    <PageFrame title="Submission Kinds">
      <div>
        {items.length === 0 && <EmptyMessage message="No Submission Kinds created yet" />}
        <table className="text-left table-fixed dark:text-white">
          <thead className="">
            <tr className="border-gray-400 border-b-[1px] pointer-events-none">
              <th className="px-4 py-2" title="default submission kind"></th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2 min-w-[250px]">Content</th>
              <th className="px-4 py-2">Checks</th>
              {canEdit && (
                <th className="py-2 pl-4 pointer-events-none">
                  <SquarePen className="w-4 h-4 pointer-events-none" />
                </th>
              )}
              {canDelete && (
                <th className="py-2 pr-4 pointer-events-none">
                  <Trash2 className="w-4 h-4 pointer-events-none" />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="">
            {items.map((k) => {
              const checks = Array.isArray(k.checks) ? (k.checks as Array<{ id: string }>) : [];
              const { title, description } = k.content as any;
              const editingMe = editInitialState?.id === k.id;
              return (
                <tr
                  key={k.id}
                  className="space-x-4 border-b-[1px] border-gray-300 last:border-none"
                >
                  <td className="px-4 py-2 text-center">
                    {k.default ? (
                      <SquareCheckBig className="inline w-4 h-4 stroke-green-500" />
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="px-4 py-2 pointer-events-none">
                    <SlugLike>{k.name}</SlugLike>
                  </td>
                  <td className="px-4 py-2 text-left">
                    <div className="text-lg font-semibold">{title ?? 'no title'}</div>
                    <div>
                      {description ?? (
                        <span className="font-light text-gray-400 dark:text-gray-500">
                          no description
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 pointer-events-none">
                    {checks.length > 0 ? (
                      <span className="font-mono text-xs text-red-900">
                        {checks.flatMap((c, i) =>
                          i === checks.length - 1 ? (
                            <CheckInfo key={`${k.id}-${i}`} check={c} />
                          ) : (
                            [<CheckInfo key={`${k.id}-${i}`} check={c} />, ' · ']
                          ),
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-2 pl-4">
                      <SquarePen
                        className={classNames('w-4 h-4', {
                          'stroke-gray-700 hover:stroke-black dark:stroke-gray-300 dark:hover:stroke-white cursor-pointer':
                            !editingMe,
                          'stroke-gray-400 dark:stroke-gray-700 cursor-not-allowed':
                            editingMe || fetcher.state !== 'idle',
                        })}
                        onClick={() => handleStartEditing(k)}
                      />
                    </td>
                  )}
                  {canDelete && (
                    <td className="py-2 pr-4">
                      <Trash2
                        className={classNames('w-4 h-4', {
                          'stroke-gray-700 hover:stroke-black dark:stroke-gray-300 dark:hover:stroke-white cursor-pointer':
                            fetcher.state === 'idle',
                          'stroke-gray-300 dark:stroke-gray-700 cursor-not-allowed':
                            fetcher.state !== 'idle',
                        })}
                        onClick={() => handleDelete(k)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="py-4">
          {(canCreate || (canEdit && editInitialState)) && (
            <>
              <h2 className="flex items-center text-lg font-semibold">
                {editInitialState ? (
                  <>
                    <span className="inline-block mr-1">Editing Kind:</span>
                    <SlugLike>{editInitialState.name}</SlugLike>
                  </>
                ) : (
                  'Create a new Submission Kind'
                )}
              </h2>
              <SubmissionKindForm
                formAction={editInitialState ? 'kind-edit' : 'kind-create'}
                initialState={editInitialState ?? { default: items.length === 0 }}
                onReset={() => setEditInitialState(null)}
                onSuccess={() => setEditInitialState(null)}
              />
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
