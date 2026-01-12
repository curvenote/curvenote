import { data, useFetcher } from 'react-router';
import { SquarePen, Trash2 } from 'lucide-react';
import {
  EmptyMessage,
  PageFrame,
  site as siteScopes,
  clientCheckSiteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { withAppSiteContext } from '@curvenote/scms-server';
import { useState } from 'react';
import type { CollectionsDBO, KindsDBO } from './db.server.js';
import { dbListSubmissionKinds } from './db.server.js';
import { CollectionForm } from './CollectionForm.js';
import { CollectionListItem } from './CollectionListItem.js';
import { $actionCollectionCreate } from './create.server.js';
import { $actionCollectionDelete } from './delete.server.js';
import { $actionCollectionEdit } from './update.server.js';
import { dbListCollections } from '../$siteName.collections/db.server.js';
import type { SiteDTO } from '@curvenote/common';

interface LoaderData {
  scopes: string[];
  items: CollectionsDBO;
  kinds: KindsDBO;
  site: SiteDTO;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.collections.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const items = await dbListCollections(ctx.site.id);
  const kinds = await dbListSubmissionKinds(ctx.site.id);
  return { scopes: ctx.scopes, items, kinds, site: ctx.siteDTO };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    siteScopes.collections.create,
    siteScopes.collections.delete,
    siteScopes.collections.update,
  ]);

  const { siteName } = args.params;
  if (!siteName) return data({ error: 'Missing siteName' }, { status: 400 });

  const formData = await args.request.formData();

  const formAction = formData.get('formAction');
  if (!formAction) return data({ error: 'Missing formAction' }, { status: 400 });
  if (formAction === 'collection-create') {
    return $actionCollectionCreate(ctx, formData);
  } else if (formAction === 'collection-delete') {
    return $actionCollectionDelete(ctx, formData);
  } else if (formAction === 'collection-edit') {
    return $actionCollectionEdit(ctx, formData);
  }

  return null;
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Collections', loaderData?.site?.title, branding.title) }];
};

export default function CollectionsClassic({ loaderData }: { loaderData: LoaderData }) {
  const { scopes, items, kinds, site } = loaderData;
  const [editing, setEditing] = useState<CollectionsDBO[0] | undefined>();

  const fetcher = useFetcher<typeof action>();
  const handleDelete = (c: CollectionsDBO[0]) => {
    if (c._count.submissions > 0 || fetcher.state !== 'idle') return;
    if (!confirm(`Are you sure you want to delete the collection "${c.name}"?`)) return;
    fetcher.submit(
      {
        formAction: 'collection-delete',
        id: c.id,
      },
      {
        method: 'POST',
      },
    );
  };

  const canRead = clientCheckSiteScopes(
    scopes,
    [siteScopes.collections.read, siteScopes.collections.list],
    site.name,
  );
  const canCreate = clientCheckSiteScopes(scopes, [siteScopes.collections.create], site.name);
  const canEdit = clientCheckSiteScopes(scopes, [siteScopes.collections.update], site.name);
  const canDelete = clientCheckSiteScopes(scopes, [siteScopes.collections.delete], site.name);

  const handleStartEdit = (c: CollectionsDBO[0]) => {
    setEditing(c);
  };

  const deletingId =
    fetcher.state !== 'idle' && fetcher.formData?.get('formAction') === 'collection-delete'
      ? (fetcher.formData?.get('id') as string)
      : null;

  if (!canRead) return null;

  return (
    <PageFrame
      title="Collections"
      subtitle={`Manage the collections of submissions and works for ${site.title}`}
    >
      <div>
        {items.length === 0 && <EmptyMessage message="No Collections created yet" />}
        {items.length > 0 && (
          <>
            <table className="mb-16 text-left table-auto dark:text-white">
              <thead className="">
                <tr className="border-gray-400 border-b-[1px]">
                  <th className="py-2 text-center"></th>
                  <th className="px-4 py-2">Name</th>
                  <th
                    className="px-4 py-2"
                    title="a url slug that will be used on thw website to access the contents of the collection"
                  >
                    Slug
                  </th>
                  <th className="px-4 py-2">Workflow</th>
                  <th className="px-4 py-2">Content</th>
                  <th className="px-4 py-2">Submission Kinds</th>
                  <th className="px-4 py-2" title="Number of submissions">
                    #
                  </th>
                  <th className="px-4 py-2">Parent</th>
                  <th className="px-4 py-2">Sub-Collections</th>
                  {canEdit && (
                    <th className="py-2 pl-4 pointer-events-none">
                      <SquarePen className="w-4 h-4 pointer-events-none" />
                    </th>
                  )}
                  {canDelete && (
                    <th className="py-2 pl-1 pr-4 pointer-events-none">
                      <Trash2 className="w-4 h-4 pointer-events-none" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="">
                {items.map((c) => (
                  <CollectionListItem
                    key={c.id}
                    c={c}
                    deletingId={deletingId}
                    editingId={editing?.id ?? null}
                    idle={fetcher.state === 'idle'}
                    handleDelete={canDelete ? handleDelete : undefined}
                    handleStartEdit={canEdit ? handleStartEdit : undefined}
                  />
                ))}
              </tbody>
            </table>
            {fetcher.data && 'error' in fetcher.data && (
              <div className="py-2 text-red-500">{String(fetcher.data.error)}</div>
            )}
          </>
        )}
      </div>
      <div>
        {(canCreate || canEdit) && (
          <>
            <h3 className="mt-8 text-lg font-semibold dark:text-white">
              {editing ? 'Edit Collection' : 'Create a Collection'}
            </h3>
            <CollectionForm
              site={site}
              formAction={editing ? 'collection-edit' : 'collection-create'}
              initialState={editing ?? { default: items.length === 0 }}
              items={items}
              kinds={kinds}
              onReset={() => setEditing(undefined)}
              onSuccess={() => setEditing(undefined)}
            />
          </>
        )}
      </div>
    </PageFrame>
  );
}
