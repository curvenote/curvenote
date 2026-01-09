import { data as dataRouter } from 'react-router';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { userHasScope } from '@curvenote/scms-server';
import { site as siteScopes } from '@curvenote/scms-core';
import { dbCollectionExists, dbCreateCollection, dbListCollections } from './db.server.js';
import { deleteCollection } from '../$siteName.collections.$collectionName/actionHelpers.server.js';
import { SiteTrackEvent } from '../../analytics/events.js';

export const SimpleCreateCollectionSchemaObject = {
  name: zfd.text(
    z
      .string()
      .min(1)
      .max(64)
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-_\s]+$/)
      .transform((v) => v.replace(/\s+/g, '-')),
  ),
  title: zfd.text(z.string().min(1).max(64)),
  description: zfd.text(z.string().min(1).max(1024).optional()),
};

export async function $actionSimpleCollectionCreate(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasScope(ctx.user, siteScopes.collections.create, ctx.site.name))
    return dataRouter(
      { error: "you don't have permission to create a collection (unauthorized)" },
      { status: 401 },
    );
  const SimpleCreateCollectionSchema = zfd.formData(SimpleCreateCollectionSchemaObject);
  let payload;
  try {
    payload = SimpleCreateCollectionSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return dataRouter({ error: error?.issues ?? error }, { status: 400 });
  }

  const name = payload.name.toLowerCase();
  const nameExists = await dbCollectionExists(ctx.site.name, { name });
  if (nameExists) {
    return dataRouter({ error: 'Collection names must be unique' }, { status: 400 });
  }
  const slugExists = await dbCollectionExists(ctx.site.name, { slug: name });
  if (slugExists) {
    return dataRouter({ error: 'Collection name must not match existing slug' }, { status: 400 });
  }
  const defaultExists = await dbCollectionExists(ctx.site.name, { default: true });

  let kindIds: string[] = [];
  const defaultKind = ctx.site.submissionKinds.find((k) => k.default);
  if (defaultKind) kindIds = [defaultKind.id];

  const data = {
    ...payload,
    name,
    slug: name,
    title: payload.title,
    workflow: ctx.site.default_workflow ?? (ctx.site.private ? 'PRIVATE' : 'SIMPLE'),
    description: payload.description,
    open: false,
    default: !defaultExists,
    parent_id: null,
  };

  const collection = await dbCreateCollection(ctx.site.name, data, kindIds);

  await ctx.trackEvent(SiteTrackEvent.SITE_COLLECTION_CREATED, {
    collectionId: collection.id,
    collectionName: collection.name,
    collectionTitle: (collection.content as any)?.title,
    collectionDescription: (collection.content as any)?.description,
    workflow: collection.workflow,
    default: collection.default,
  });

  await ctx.analytics.flush();

  const items = await dbListCollections(ctx.site.id);
  return { items };
}

export async function $actionDeleteCollection(ctx: SiteContextWithUser, formData: FormData) {
  const collectionId = formData.get('collectionId') as string;
  if (!collectionId) {
    return dataRouter({ error: 'Missing collection ID' }, { status: 400 });
  }

  try {
    await deleteCollection(ctx, collectionId);

    await ctx.trackEvent(SiteTrackEvent.SITE_COLLECTION_DELETED, {
      collectionId: collectionId,
    });

    await ctx.analytics.flush();

    const items = await dbListCollections(ctx.site.id);
    return { items };
  } catch (error: any) {
    console.error(`Error deleting collection: ${error}`);
    return dataRouter({ error: 'Failed to delete collection' }, { status: 500 });
  }
}
