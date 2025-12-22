import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { redirect, data, useFetcher } from 'react-router';
import {
  PageFrame,
  primitives,
  ui,
  httpError,
  getBrandingFromMetaMatches,
  joinPageTitle,
  SectionWithHeading,
  scopes,
} from '@curvenote/scms-core';
import { Library, Trash2, Shapes, Settings, Pencil } from 'lucide-react';
import type { SubmissionKindDBO } from '@curvenote/scms-server';
import { withAppSiteContext } from '@curvenote/scms-server';
import { dbListCollections } from '../$siteName.collections/db.server.js';
import { CollectionToggleItem } from './CollectionToggleItem.js';
import {
  updateCollectionDefault,
  updateCollectionTitle,
  updateCollectionDescription,
  updateCollectionName,
  updateCollectionKind,
  updateCollectionOpen,
  updateCollectionParent,
  deleteCollection,
} from './actionHelpers.server.js';
import { useState, useRef } from 'react';
import { plural } from 'myst-common';

type LoaderData = Awaited<ReturnType<typeof dbListCollections>>[0] & {
  siteName: string;
  siteTitle: string;
  kinds: SubmissionKindDBO[];
  defaultCollectionTitle: string;
  allCollections: Awaited<ReturnType<typeof dbListCollections>>;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.collections.read]);

  const { collectionName } = args.params;
  if (!collectionName) throw httpError(400, 'Missing collection name');

  const collections = await dbListCollections(ctx.site.id);
  const collection = collections.find((c) => c.name === collectionName);
  if (!collection) throw httpError(404, 'Collection not found');

  const kinds = ctx.site.submissionKinds ?? [];
  const defaultColl = collections.find((c) => c.default && c.name !== collectionName);
  const defaultCollectionTitle = (defaultColl?.content as any)?.title ?? defaultColl?.name;

  return {
    ...collection,
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    kinds,
    defaultCollectionTitle,
    allCollections: collections,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    scopes.site.collections.update,
    scopes.site.collections.delete,
  ]);

  if (args.request.method.toLowerCase() !== 'post') {
    return data(
      { success: false, error: { message: 'An unexpected error occurred' } },
      { status: 400 },
    );
  }
  const { collectionName } = args.params;
  if (!collectionName) throw httpError(400, 'Missing collection name');

  const collection = ctx.site.collections.find(({ name }) => name === collectionName);
  if (!collection) throw httpError(404, 'Collection not found');

  const formData = await args.request.formData();
  const intent = formData.get('intent');
  try {
    switch (intent) {
      case 'update-collection-default':
        return updateCollectionDefault(ctx, collection.id, formData);
      case 'delete-collection':
        await deleteCollection(ctx, collection.id);
        return redirect(`/app/sites/${ctx.site.name}/collections`);
      case 'update-collection-title':
        return updateCollectionTitle(ctx, collection.id, formData);
      case 'update-collection-description':
        return updateCollectionDescription(ctx, collection.id, formData);
      case 'update-collection-name': {
        const updatedCollectionOrError = await updateCollectionName(ctx, collection.id, formData);
        if ('name' in updatedCollectionOrError && updatedCollectionOrError.name) {
          const name = updatedCollectionOrError.name;
          return redirect(`/app/sites/${ctx.site.name}/collections/${name}`);
        }
        return updatedCollectionOrError;
      }
      case 'update-collection-kind':
        return updateCollectionKind(ctx, collection.id, formData);
      case 'update-collection-open':
        return updateCollectionOpen(ctx, collection.id, formData);
      case 'update-collection-parent':
        return updateCollectionParent(ctx, collection.id, formData);
      default:
        return data(
          { error: { type: 'general', message: `Invalid intent ${intent}` } },
          { status: 400 },
        );
    }
  } catch (error) {
    if (error instanceof Error) {
      return data({ error: { message: error.message } }, { status: 404 });
    }
    return data({ error: { message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(
        (loaderData?.content as any)?.title,
        'Collection Details',
        loaderData?.siteName,
        branding.title,
      ),
    },
  ];
};

export default function CollectionDetails({ loaderData }: { loaderData: LoaderData }) {
  const { kinds, defaultCollectionTitle, siteName, siteTitle, allCollections, ...collection } =
    loaderData;
  const fetcher = useFetcher();
  const parentFormRef = useRef<HTMLFormElement>(null);

  const title = (collection.content as any)?.title;
  const description = (collection.content as any)?.description;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle, href: `/app/sites/${siteName}` },
    { label: 'Collections', href: `/app/sites/${siteName}/collections` },
    { label: title ?? collection.name, isCurrentPage: true },
  ];

  const [nameError, setNameError] = useState<string | null>(null);

  function validateCollectionName(name: string): string | null {
    if (!name || name.trim().length === 0) return 'Name is required';
    if (name.length > 64) return 'Name must be at most 64 characters';
    if (!/^[a-z0-9\-_]+$/.test(name))
      return 'Only lowercase letters, numbers, hyphens, underscores';
    return null;
  }

  function handleNameChange(newName: string) {
    const error = validateCollectionName(newName);
    setNameError(error);
  }

  const includedKindIds = new Set((collection.kindsInCollection || []).map((k: any) => k.kind.id));
  // Map kindId to work count if available
  const kindWorkCounts: Record<string, number> = {};
  (collection.kindsInCollection || []).forEach((k: any) => {
    kindWorkCounts[k.kind.id] = k.kind._count?.works || 0;
  });
  const submissionsCount = collection._count.submissions;
  const canDelete = !submissionsCount;
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <PageFrame
      className="max-w-4xl"
      title={
        <>
          Edit Collection: <strong>{title ?? collection.name}</strong>
        </>
      }
      subtitle={`Edit details for the ${title ?? collection.name} collection.`}
      breadcrumbs={breadcrumbs}
    >
      <primitives.Card className="flex relative flex-col gap-4 p-8 mb-8" lift>
        <div className="flex gap-4">
          <div className="flex gap-3 items-center mb-2 grow">
            <Library className="w-6 h-6 text-stone-500 stroke-[1.5px]" aria-label="Collection" />
            <ui.InlineEditable
              intent="update-collection-title"
              defaultValue={title}
              className="text-2xl"
              ariaLabel="Edit collection title"
              placeholder="Collection title"
              renderDisplay={(value) => <span className="font-bold">{value}</span>}
            />
          </div>
          <div>
            <ui.InlineEditable
              intent="update-collection-name"
              defaultValue={collection.name}
              ariaLabel="Edit collection name"
              error={nameError || undefined}
              onChange={handleNameChange}
              renderDisplay={(value) => (
                <span className="px-3 py-1 font-mono text-xs rounded-full border border-stone-400 dark:border-stone-200">
                  {value}
                </span>
              )}
              className="px-3 py-1 font-mono text-xs"
            />
          </div>
        </div>
        <div>
          <ui.InlineEditable
            intent="update-collection-description"
            defaultValue={description}
            multiline
            ariaLabel="Edit collection description"
            placeholder="Collection description"
          />
        </div>
      </primitives.Card>
      <primitives.Card className="flex flex-col gap-0 p-0 mb-8" lift>
        <CollectionToggleItem
          intent="update-collection-open"
          title="Can anyone submit to this collection?"
          yesText="Yes, public submissions allowed"
          noText="No, only authorized site users can submit"
          checked={collection.open}
        />
      </primitives.Card>
      <SectionWithHeading
        heading={<span className="font-normal">Which kinds are allowed in this collection?</span>}
        className="mb-8"
        icon={<Shapes className="w-6 h-6 stroke-[1.5px]" />}
      >
        <div className="rounded bg-muted">
          {kinds && kinds.length > 0 ? (
            <primitives.Card className="p-0" lift>
              <div className="flex flex-col divide-y divide-stone-300 dark:divide-stone-700">
                {kinds.map((kind) => {
                  const included = includedKindIds.has(kind.id);
                  return (
                    <CollectionToggleItem
                      intent={`update-collection-kind`}
                      title={(kind.content as any)?.title ?? kind.name}
                      checked={included}
                      data={kind.id}
                    />
                  );
                })}
              </div>
            </primitives.Card>
          ) : (
            <div className="flex flex-col justify-center items-center py-8 text-center text-muted-foreground">
              <Pencil className="mb-2 w-8 h-8 text-muted-foreground" />
              <a
                href={`/app/sites/${siteName}/kinds`}
                className="text-base text-blue-600 rounded hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                No kinds defined.
              </a>
            </div>
          )}
        </div>
      </SectionWithHeading>
      <SectionWithHeading
        heading={<span className="font-normal">Advanced</span>}
        className="mb-8"
        icon={<Settings className="w-6 h-6 stroke-[1.5px]" />}
      >
        <primitives.Card className="flex flex-col gap-0 p-0" lift>
          <CollectionToggleItem
            intent="update-collection-default"
            title="Make this the default collection?"
            yesText="Yes, this is the default collection"
            noText={
              defaultCollectionTitle
                ? `No, keep "${defaultCollectionTitle}" as the default collection`
                : 'No, there is no default collection'
            }
            checked={collection.default}
          />
          <div className="px-6 py-4 border-t border-stone-200">
            <div className="flex justify-between items-center">
              <div className="flex gap-4 items-center">
                <span className="text-sm text-stone-700">
                  <span className="font-semibold">Parent:</span>
                </span>
                <fetcher.Form method="post" className="w-48" ref={parentFormRef}>
                  <input type="hidden" name="intent" value="update-collection-parent" />
                  <ui.Select
                    name="value"
                    defaultValue={collection.parent_id || 'none'}
                    onValueChange={(value) => {
                      if (parentFormRef.current) {
                        const formData = new FormData(parentFormRef.current);
                        formData.set('value', value);
                        fetcher.submit(formData, { method: 'post' });
                      }
                    }}
                  >
                    <ui.SelectTrigger className="w-full">
                      <ui.SelectValue />
                    </ui.SelectTrigger>
                    <ui.SelectContent>
                      <ui.SelectItem value="none">None</ui.SelectItem>
                      {allCollections
                        .filter((c) => c.id !== collection.id)
                        .map((c) => (
                          <ui.SelectItem key={c.id} value={c.id}>
                            {(c.content as any)?.title ?? c.name}
                          </ui.SelectItem>
                        ))}
                    </ui.SelectContent>
                  </ui.Select>
                </fetcher.Form>
              </div>
              <div className="text-sm text-stone-700">
                <span className="font-semibold">Workflow:</span> {collection.workflow}
              </div>
            </div>
          </div>
        </primitives.Card>
      </SectionWithHeading>
      <div className="flex justify-end mt-2">
        <ui.Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <ui.DialogTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-2 text-red-600 bg-transparent border-none p-0 m-0 text-sm font-medium ${submissionsCount ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:underline hover:text-red-700'}`}
              disabled={!canDelete}
            >
              <Trash2 className="w-4 h-4" />
              {`${submissionsCount ? `Cannot delete: collection has ${plural('%s submission(s)', submissionsCount)}` : 'Delete Collection'}`}
            </button>
          </ui.DialogTrigger>
          <ui.DialogContent>
            <ui.DialogHeader>
              <ui.DialogTitle>Delete Collection</ui.DialogTitle>
              <ui.DialogDescription>
                Are you sure you want to delete the collection <b>{title}</b>? This action cannot be
                undone.
              </ui.DialogDescription>
            </ui.DialogHeader>
            <ui.DialogFooter>
              <ui.DialogClose asChild>
                <ui.Button variant="outline">Cancel</ui.Button>
              </ui.DialogClose>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete-collection" />
                <ui.Button type="submit" variant="destructive" onClick={() => setDialogOpen(false)}>
                  Delete Collection
                </ui.Button>
              </fetcher.Form>
            </ui.DialogFooter>
          </ui.DialogContent>
        </ui.Dialog>
      </div>
    </PageFrame>
  );
}
