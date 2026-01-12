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
import { FileText, Trash2, Shapes, Library, ExternalLink } from 'lucide-react';
import type { SubmissionKindDBO } from '@curvenote/scms-server';
import { withAppSiteContext } from '@curvenote/scms-server';
import { dbListCollections } from '../$siteName.collections/db.server.js';
import { dbGetForm } from './db.server.js';
import { FormCollectionToggleItem } from './FormCollectionToggleItem.js';
import {
  updateFormTitle,
  updateFormDescription,
  updateFormName,
  updateFormKind,
  updateFormCollection,
  deleteForm,
} from './actionHelpers.server.js';
import { useState, useRef, useEffect } from 'react';

type LoaderData = Awaited<ReturnType<typeof dbGetForm>> & {
  siteName: string;
  siteTitle: string;
  kinds: SubmissionKindDBO[];
  allCollections: Awaited<ReturnType<typeof dbListCollections>>;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.forms.read]);

  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const form = await dbGetForm(formName, ctx.site.id);
  const kinds = ctx.site.submissionKinds ?? [];
  const allCollections = await dbListCollections(ctx.site.id);

  return {
    ...form,
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    kinds,
    allCollections,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [scopes.site.forms.update, scopes.site.forms.delete]);

  if (args.request.method.toLowerCase() !== 'post') {
    return data(
      { success: false, error: { message: 'An unexpected error occurred' } },
      { status: 400 },
    );
  }
  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const form = await dbGetForm(formName, ctx.site.id);
  const formData = await args.request.formData();
  const intent = formData.get('intent');
  try {
    switch (intent) {
      case 'update-form-name': {
        const updatedFormOrError = await updateFormName(ctx, form.id, formData);
        if ('name' in updatedFormOrError && updatedFormOrError.name) {
          return redirect(`/app/sites/${ctx.site.name}/forms/${updatedFormOrError.name}`);
        }
        return updatedFormOrError;
      }
      case 'update-form-title':
        return updateFormTitle(ctx, form.id, formData);
      case 'update-form-description':
        return updateFormDescription(ctx, form.id, formData);
      case 'update-form-kind':
        return updateFormKind(ctx, form.id, formData);
      case 'update-form-collection':
        return updateFormCollection(ctx, form.id, formData);
      case 'delete-form':
        await deleteForm(ctx, form.id);
        return redirect(`/app/sites/${ctx.site.name}/forms`);
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
        'Form Details',
        loaderData?.siteName,
        branding.title,
      ),
    },
  ];
};

export default function FormDetails({ loaderData }: { loaderData: LoaderData }) {
  const { kinds, siteName, siteTitle, allCollections, ...form } = loaderData;
  const fetcher = useFetcher();
  const kindFormRef = useRef<HTMLFormElement>(null);

  const title = (form.content as any)?.title;
  const description = (form.content as any)?.description;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle || siteName, href: `/app/sites/${siteName}/inbox` },
    { label: 'Submission Forms', href: `/app/sites/${siteName}/forms` },
    { label: title ?? form.name, isCurrentPage: true },
  ];

  const [nameError, setNameError] = useState<string | null>(null);
  const [currentKindId, setCurrentKindId] = useState(form.kind_id);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(
    new Set(form.collections.map((cif: any) => cif.collection.id)),
  );
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Update state when loaderData changes (after kind update)
  useEffect(() => {
    setCurrentKindId(form.kind_id);
    setSelectedCollectionIds(new Set(form.collections.map((cif: any) => cif.collection.id)));
  }, [form.kind_id, form.collections]);

  function validateFormName(name: string): string | null {
    if (!name || name.trim().length === 0) return 'Name is required';
    if (name.length > 64) return 'Name must be at most 64 characters';
    if (!/^[a-z0-9\-_]+$/.test(name))
      return 'Only lowercase letters, numbers, hyphens, underscores';
    return null;
  }

  function handleNameChange(newName: string) {
    const error = validateFormName(newName);
    setNameError(error);
  }

  // Check if a collection is compatible with the current kind
  function isCollectionCompatible(collection: any, kindId?: string): boolean {
    const kindToCheck = kindId ?? currentKindId;
    return collection.kindsInCollection.some((kic: any) => kic.kind.id === kindToCheck);
  }

  // Get the current kind name for error messages
  const currentKind = kinds.find((k) => k.id === currentKindId);
  const currentKindTitle = currentKind
    ? ((currentKind.content as any)?.title ?? currentKind.name)
    : '';

  // Handle kind change - server will ensure at least one compatible collection is selected
  function handleKindChange(newKindId: string) {
    setCurrentKindId(newKindId);

    // Optimistically update selected collections - remove incompatible ones
    // The server will also handle this, but we update UI immediately
    setSelectedCollectionIds((prev) => {
      const next = new Set(prev);
      prev.forEach((id) => {
        const collection = allCollections.find((c) => c.id === id);
        if (collection && !isCollectionCompatible(collection, newKindId)) {
          next.delete(id);
        }
      });
      return next;
    });

    // Submit the kind change - server will handle collection updates (removing incompatible ones)
    if (kindFormRef.current) {
      const formData = new FormData(kindFormRef.current);
      formData.set('value', newKindId);
      fetcher.submit(formData, { method: 'post' });
    }
  }

  // Handle collection toggle
  function handleCollectionToggle(collectionId: string, value: boolean) {
    const newSelected = new Set(selectedCollectionIds);
    if (value) {
      newSelected.add(collectionId);
    } else {
      newSelected.delete(collectionId);
    }

    // Validate: must have at least one collection
    if (newSelected.size === 0) {
      setCollectionError('At least one collection must be selected');
      return;
    }

    setCollectionError(null);
    setSelectedCollectionIds(newSelected);

    // Submit the change
    const formData = new FormData();
    formData.append('intent', 'update-form-collection');
    formData.append('value', value ? 'true' : 'false');
    formData.append('data', collectionId);
    fetcher.submit(formData, { method: 'post' });
  }

  // Validate collections on mount and when collections change
  useEffect(() => {
    if (selectedCollectionIds.size === 0) {
      setCollectionError('At least one collection must be selected');
    } else {
      setCollectionError(null);
    }
  }, [selectedCollectionIds]);

  return (
    <PageFrame
      className="max-w-4xl"
      title={
        <>
          Edit Form: <strong>{title ?? form.name}</strong>
        </>
      }
      subtitle={`Edit details for the ${title ?? form.name} submission form`}
      breadcrumbs={breadcrumbs}
    >
      <primitives.Card className="relative flex flex-col gap-4 p-8 mb-8" lift>
        <div className="flex gap-4">
          <div className="flex items-center gap-3 mb-2 grow">
            <FileText className="w-8 h-8 text-stone-500 stroke-[1.5px]" aria-label="Form" />
            <ui.InlineEditable
              intent="update-form-title"
              defaultValue={title}
              className="text-2xl"
              ariaLabel="Edit form title"
              placeholder="Form title"
              renderDisplay={(value) => <span className="font-bold">{value}</span>}
            />
          </div>
          <div>
            <ui.InlineEditable
              intent="update-form-name"
              defaultValue={form.name}
              ariaLabel="Edit form name"
              error={nameError || undefined}
              onChange={handleNameChange}
              renderDisplay={(value) => (
                <span className="px-3 py-1 font-mono text-xs border rounded-full border-stone-400 dark:border-stone-200">
                  {value}
                </span>
              )}
              className="px-3 py-1 font-mono text-xs"
            />
          </div>
        </div>
        <div>
          <ui.InlineEditable
            intent="update-form-description"
            defaultValue={description}
            multiline
            ariaLabel="Edit form description"
            placeholder="Form description"
          />
        </div>
      </primitives.Card>

      <SectionWithHeading
        heading={<span className="font-normal">Which kind does this form use?</span>}
        className="mb-8"
        icon={<Shapes className="w-6 h-6 stroke-[1.5px]" />}
      >
        <primitives.Card className="p-0" lift>
          <div className="px-6 py-4">
            <fetcher.Form method="post" className="w-full" ref={kindFormRef}>
              <input type="hidden" name="intent" value="update-form-kind" />
              <ui.Select name="value" value={currentKindId} onValueChange={handleKindChange}>
                <ui.SelectTrigger className="w-full">
                  <ui.SelectValue />
                </ui.SelectTrigger>
                <ui.SelectContent>
                  {kinds.map((kind) => (
                    <ui.SelectItem key={kind.id} value={kind.id}>
                      {(kind.content as any)?.title ?? kind.name}
                    </ui.SelectItem>
                  ))}
                </ui.SelectContent>
              </ui.Select>
            </fetcher.Form>
          </div>
        </primitives.Card>
      </SectionWithHeading>

      <SectionWithHeading
        heading={<span className="font-normal">Which collections can this form submit to?</span>}
        className="mb-8"
        icon={<Library className="w-6 h-6 stroke-[1.5px]" />}
      >
        {collectionError && (
          <div className="p-3 mb-4 text-sm text-red-600 border border-red-200 rounded bg-red-50">
            {collectionError}
          </div>
        )}
        <div className="rounded bg-muted">
          {allCollections && allCollections.length > 0 ? (
            <primitives.Card className="p-0" lift>
              <div className="flex flex-col divide-y divide-stone-300 dark:divide-stone-700">
                {allCollections.map((collection) => {
                  const included = selectedCollectionIds.has(collection.id);
                  const compatible = isCollectionCompatible(collection);
                  const disabledMessage = compatible
                    ? undefined
                    : `Collection does not accept kind "${currentKindTitle}"`;

                  return (
                    <FormCollectionToggleItem
                      key={collection.id}
                      intent="update-form-collection"
                      title={(collection.content as any)?.title ?? collection.name}
                      checked={included}
                      disabled={!compatible}
                      disabledMessage={disabledMessage}
                      data={collection.id}
                      onToggle={(value) => handleCollectionToggle(collection.id, value)}
                    />
                  );
                })}
              </div>
            </primitives.Card>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Library className="w-8 h-8 mb-2 text-muted-foreground" />
              <span className="text-base">No collections available.</span>
            </div>
          )}
        </div>
      </SectionWithHeading>

      <div className="flex items-center justify-between mt-2">
        <div>
          <a
            href={`/app/sites/${siteName}/submit/${form.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            View Form
            <ExternalLink className="inline-block w-3 h-3 align-middle" />
          </a>
        </div>
        <div>
          <ui.Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <ui.DialogTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 p-0 m-0 text-sm font-medium text-red-600 bg-transparent border-none cursor-pointer hover:underline hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete Form
              </button>
            </ui.DialogTrigger>
            <ui.DialogContent>
              <ui.DialogHeader>
                <ui.DialogTitle>Delete Form</ui.DialogTitle>
                <ui.DialogDescription>
                  Are you sure you want to delete the form <b>{title}</b>? This action cannot be
                  undone.
                </ui.DialogDescription>
              </ui.DialogHeader>
              <ui.DialogFooter>
                <ui.DialogClose asChild>
                  <ui.Button variant="outline">Cancel</ui.Button>
                </ui.DialogClose>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete-form" />
                  <ui.Button
                    type="submit"
                    variant="destructive"
                    onClick={() => setDialogOpen(false)}
                  >
                    Delete Form
                  </ui.Button>
                </fetcher.Form>
              </ui.DialogFooter>
            </ui.DialogContent>
          </ui.Dialog>
        </div>
      </div>
    </PageFrame>
  );
}
