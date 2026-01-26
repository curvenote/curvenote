import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, scopes } from '@curvenote/scms-core';
import { CreateFormForm } from './CreateFormForm.js';
import { FormCard } from './FormCard.js';
import { withAppSiteContext } from '@curvenote/scms-server';
import { createForm, deleteFormAction } from './actionHelpers.server.js';
import { dbListForms } from './db.server.js';

interface LoaderData {
  siteName: string;
  siteTitle: string;
  forms: Awaited<ReturnType<typeof dbListForms>>;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.forms.list]);
  const forms = await dbListForms(ctx.site.id);
  return {
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    forms,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [scopes.site.forms.create, scopes.site.forms.delete]);

  const formData = await args.request.formData();
  const intent = formData.get('intent');
  try {
    switch (intent) {
      case 'delete-form':
        return deleteFormAction(ctx, formData);
      case 'create-form':
        return createForm(ctx, formData);
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
  return [{ title: joinPageTitle('Submission Forms', loaderData?.siteTitle, branding.title) }];
};

export default function Forms({ loaderData }: { loaderData: LoaderData }) {
  const { siteName, siteTitle, forms } = loaderData;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle || siteName, href: `/app/sites/${siteName}/inbox` },
    { label: 'Submission Forms', isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Submission Forms"
      subtitle={`Define the submission forms available for ${siteTitle}`}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col gap-6">
        <CreateFormForm />
        <div className="grid grid-cols-1 gap-6 mt-2 md:grid-cols-2">
          {forms.map((form: any) => (
            <FormCard key={form.id} form={form} siteName={siteName} />
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
