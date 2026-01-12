import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { redirect, data, useActionData, Form } from 'react-router';
import {
  primitives,
  ui,
  httpError,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
} from '@curvenote/scms-core';
import { FileText, User } from 'lucide-react';
import { withAppSiteContext } from '@curvenote/scms-server';
import { dbGetForm } from '../$siteName.forms.$formName/db.server.js';
import { dbListCollections } from '../$siteName.collections/db.server.js';
import { submitForm } from './actionHelpers.server.js';

type LoaderData = Awaited<ReturnType<typeof dbGetForm>> & {
  siteName: string;
  siteTitle: string;
  formCollections: Awaited<ReturnType<typeof dbListCollections>>;
  user: {
    name?: string;
    email?: string;
    orcid?: string;
    affiliation?: string;
  } | null;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.submissions.create]);

  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const form = await dbGetForm(formName, ctx.site.id);
  const collections = await dbListCollections(ctx.site.id);

  // Filter collections to only those associated with the form
  const formCollectionIds = new Set(form.collections.map((cif: any) => cif.collection.id));
  const formCollections = collections.filter((c) => formCollectionIds.has(c.id));

  // Get user info if logged in
  const user = ctx.user
    ? {
        name: ctx.user.display_name ?? undefined,
        email: ctx.user.email ?? undefined,
        orcid:
          ctx.user.linkedAccounts.find((la) => la.provider === 'orcid')?.idAtProvider ?? undefined,
      }
    : null;

  return {
    ...form,
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    formCollections,
    user,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [scopes.site.submissions.create]);

  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const form = await dbGetForm(formName, ctx.site.id);
  const formData = await args.request.formData();

  try {
    const result = await submitForm(ctx, form, formData);
    if ('workId' in result && result.workId) {
      return redirect(
        `/forms/${ctx.site.name}/${formName}/success?workId=${result.workId}`,
      );
    }
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return data({ error: { message: error.message } }, { status: 400 });
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
        'Submit',
        loaderData?.siteName,
        branding.title,
      ),
    },
  ];
};

export default function SubmitForm({ loaderData }: { loaderData: LoaderData }) {
  const { siteName, siteTitle, formCollections, user, ...form } = loaderData;
  const actionData = useActionData<{ error?: { message?: string } }>();

  const title = (form.content as any)?.title ?? form.name;
  const description = (form.content as any)?.description;

  const hasMultipleCollections = formCollections.length > 1;

  return (
    <div className="max-w-3xl px-4 mx-auto mt-8">
      <primitives.Card className="p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          )}
        </div>

        {actionData?.error && (
          <div className="p-4 mb-6 text-sm text-red-600 border border-red-200 rounded bg-red-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {actionData.error.message || 'An error occurred while submitting'}
          </div>
        )}

        <Form method="post" className="flex flex-col gap-8">
        {/* Your Details Section */}
        <primitives.Card className="p-6" lift>
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
            <h2 className="text-xl font-semibold">Your Details</h2>
          </div>
          <div className="flex flex-col gap-4">
            <ui.TextField
              id="submitter-name"
              name="name"
              label="Name"
              placeholder="Your full name"
              required
              defaultValue={user?.name}
            />
            <ui.TextField
              id="submitter-email"
              name="email"
              type="email"
              label="Email"
              placeholder="your.email@example.com"
              required
              defaultValue={user?.email}
            />
            <ui.TextField
              id="submitter-orcid"
              name="orcid"
              label="ORCID"
              placeholder="0000-0000-0000-0000"
              defaultValue={user?.orcid}
            />
            <ui.TextField
              id="submitter-affiliation"
              name="affiliation"
              label="Affiliation"
              placeholder="Your institution or organization"
              defaultValue={user?.affiliation}
            />
            <div className="flex items-center gap-2">
              <ui.Checkbox
                id="is-corresponding-author"
                name="isCorrespondingAuthor"
                value="true"
                defaultChecked={true}
              />
              <label
                htmlFor="is-corresponding-author"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                You are the corresponding author
              </label>
            </div>
          </div>
        </primitives.Card>

        {/* Collection Selection (only if multiple) */}
        {hasMultipleCollections ? (
          <primitives.Card className="p-6" lift>
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
              <h2 className="text-xl font-semibold">Collection</h2>
            </div>
            <ui.Select name="collectionId" required>
              <ui.SelectTrigger>
                <ui.SelectValue placeholder="Select a collection" />
              </ui.SelectTrigger>
              <ui.SelectContent>
                {formCollections.map((collection) => (
                  <ui.SelectItem key={collection.id} value={collection.id}>
                    {(collection.content as any)?.title ?? collection.name}
                  </ui.SelectItem>
                ))}
              </ui.SelectContent>
            </ui.Select>
          </primitives.Card>
        ) : (
          // Hidden input for single collection
          <input type="hidden" name="collectionId" value={formCollections[0]?.id} />
        )}

        {/* Work Details Section */}
        <primitives.Card className="p-6" lift>
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
            <h2 className="text-xl font-semibold">Work Details</h2>
          </div>
          <div className="flex flex-col gap-4">
            <ui.TextField
              id="work-title"
              name="workTitle"
              label="Title"
              placeholder="Title of your work"
              required
            />
            <primitives.TextArea
              id="work-description"
              name="workDescription"
              label="Description"
              placeholder="Brief description of your work"
              rows={4}
            />
          </div>
        </primitives.Card>

        <div className="flex justify-end gap-4">
          <ui.Button type="submit" variant="default" className="px-8">
            Submit
          </ui.Button>
        </div>
      </Form>
      </primitives.Card>
    </div>
  );
}
