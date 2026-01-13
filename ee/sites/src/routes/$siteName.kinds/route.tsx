import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, scopes } from '@curvenote/scms-core';
import { CreateKindForm } from './CreateKindForm.js';
import { KindCard } from './KindCard.js';
import type { SubmissionKindDBO } from '@curvenote/scms-server';
import { withAppSiteContext } from '@curvenote/scms-server';
import { submissionRuleChecks } from '@curvenote/check-definitions';
import { createKind, deleteKind } from './actionHelpers.server.js';
import { isCheckArray } from './utils.server.js';

interface LoaderData {
  siteName: string;
  siteTitle: string;
  kinds: SubmissionKindDBO[];
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.kinds.list]);
  const kinds = (ctx.site.submissionKinds ?? []).map((kind) => {
    const checks = isCheckArray(kind.checks)
      ? kind.checks.map((check) => {
          return { ...check, ...submissionRuleChecks.find(({ id }) => id === check.id) };
        })
      : [];
    return {
      ...kind,
      checks,
    };
  });
  return {
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    kinds,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [scopes.site.kinds.create, scopes.site.kinds.delete]);

  const formData = await args.request.formData();
  const intent = formData.get('intent');
  try {
    switch (intent) {
      case 'delete-kind':
        return deleteKind(ctx, formData);
      case 'create-kind':
        return createKind(ctx, formData);
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
  return [{ title: joinPageTitle('Kinds', loaderData?.siteTitle, branding.title) }];
};

export default function Kinds({ loaderData }: { loaderData: LoaderData }) {
  const { siteName, siteTitle, kinds } = loaderData;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle || siteName, href: `/app/sites/${siteName}/inbox` },
    { label: 'Kinds', isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Submission Kinds"
      subtitle={`Define the types of submissions that are accepted by ${siteTitle}`}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col gap-6">
        <CreateKindForm />
        <div className="grid grid-cols-1 gap-6 mt-2 md:grid-cols-2">
          {kinds.map((kind: any) => (
            <KindCard key={kind.id} kind={kind} />
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
