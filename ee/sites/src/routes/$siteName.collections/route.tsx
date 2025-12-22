import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, scopes } from '@curvenote/scms-core';
import { withAppSiteContext } from '@curvenote/scms-server';
import { CollectionCard } from './CollectionCard.js';
import { ClassicCollectionsRedirect } from './ClassicCollectionsRedirect.js';
import { CreateCollectionForm } from './CreateCollectionForm.js';
import { dbListCollections } from './db.server.js';
import { $actionSimpleCollectionCreate, $actionDeleteCollection } from './actionHelpers.server.js';
import type { Collection } from '@prisma/client';

interface LoaderData {
  siteName: string;
  siteTitle: string;
  collections: Collection[];
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.collections.list]);
  const collections = await dbListCollections(ctx.site.id);
  return {
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    collections,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    scopes.site.collections.create,
    scopes.site.collections.delete,
  ]);

  const formData = await args.request.formData();
  const intent = formData.get('intent');
  if (intent === 'create-collection') {
    return $actionSimpleCollectionCreate(ctx, formData);
  }
  if (intent === 'delete-collection') {
    return $actionDeleteCollection(ctx, formData);
  }
  return data({ error: 'Unknown intent' }, { status: 400 });
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Collections', loaderData?.siteTitle, branding.title) }];
};

export default function Collections({ loaderData }: { loaderData: LoaderData }) {
  const { siteName, siteTitle, collections } = loaderData;
  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle, href: `/app/sites/${siteName}` },
    { label: 'Collections', isCurrentPage: true },
  ];
  return (
    <PageFrame
      title="Collections"
      subtitle={`Define the collections to organize submissions for ${siteTitle}`}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col gap-6">
        <CreateCollectionForm />
        <div className="grid grid-cols-1 gap-6 mt-2 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} siteName={siteName} />
          ))}
        </div>
      </div>
      <ClassicCollectionsRedirect siteName={siteName} />
    </PageFrame>
  );
}
