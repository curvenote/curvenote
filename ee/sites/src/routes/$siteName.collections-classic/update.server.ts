import { getPrismaClient, assertUserDefined, userHasScope } from '@curvenote/scms-server';
import { data as dataRouter } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { site as siteScopes } from '@curvenote/scms-core';
import { CreateCollectionSchemaObject } from './create.server.js';
import { dbCollectionExists, dbListCollections } from '../$siteName.collections/db.server.js';

async function dbEditCollection(
  siteName: string,
  data: {
    id: string;
    name: string;
    slug: string;
    workflow: string;
    title: string;
    description: string | undefined;
    open: boolean;
    default: boolean;
    parent_id: string | null;
  },
  incomingKindIds: string[],
) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = new Date().toISOString();

    if (data.default) {
      await tx.collection.updateMany({
        where: {
          site: {
            name: siteName,
          },
          default: true,
        },
        data: {
          date_modified: timestamp,
          default: false,
        },
      });
    }

    await tx.collection.update({
      where: {
        id: data.id,
      },
      data: {
        date_modified: timestamp,
        name: data.name,
        slug: data.slug,
        workflow: data.workflow,
        content: {
          title: data.title,
          description: data.description,
        },
        open: data.open,
        default: data.default,
        parentCollection: data.parent_id
          ? {
              connect: {
                id: data.parent_id,
              },
            }
          : undefined,
      },
    });

    const existingKICs = await tx.kindsInCollections.findMany({
      where: {
        collection_id: data.id,
      },
    });
    const existingKindIds = existingKICs.map((e) => e.kind_id);

    console.log('incomingKindIds', incomingKindIds);
    console.log('existingKICs', existingKICs);

    const toDelete: string[] = [];
    const toCreate: string[] = [];

    for (const existingKindId of existingKindIds) {
      if (!incomingKindIds.includes(existingKindId)) {
        toDelete.push(existingKindId);
      }
    }

    incomingKindIds.forEach((incomingKindId) => {
      if (!existingKindIds.includes(incomingKindId)) {
        toCreate.push(incomingKindId);
      }
    });

    console.log('toDelete', toDelete);
    console.log('toCreate', toCreate);

    if (toDelete.length > 0) {
      await tx.kindsInCollections.deleteMany({
        where: {
          collection_id: data.id,
          kind_id: {
            in: toDelete,
          },
        },
      });
    }

    if (toCreate.length > 0) {
      await tx.kindsInCollections.createMany({
        data: toCreate.map((kindId) => ({
          id: uuidv7(),
          date_created: timestamp,
          date_modified: timestamp,
          kind_id: kindId,
          collection_id: data.id,
        })),
      });
    }
  });
}

export async function $actionCollectionEdit(ctx: SiteContext, formData: FormData) {
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, siteScopes.collections.update, ctx.site.name))
    return dataRouter(
      { error: "you don't have permission to update a collection (unauthorized)" },
      { status: 401 },
    );

  const UpdateCollectionSchema = zfd.formData({
    ...CreateCollectionSchemaObject,
    id: zfd.text(z.uuid()),
  });

  let payload;
  try {
    payload = UpdateCollectionSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return dataRouter({ error: error?.issues ?? error }, { status: 400 });
  }

  if (!payload.id) {
    return dataRouter({ error: 'Missing collection id' }, { status: 400 });
  }

  const name = payload.name.toLowerCase();
  const exists = await dbCollectionExists(ctx.site.name, { id: payload.id });
  if (!exists) {
    return dataRouter({ error: 'Collection not found' }, { status: 400 });
  }

  const { parent: parentId } = payload;
  if (parentId !== 'none') {
    const parentExists = await dbCollectionExists(ctx.site.name, { id: parentId });
    if (!parentExists) {
      return dataRouter({ error: 'Parent collection not found' }, { status: 400 });
    }
  }

  const kindKeys = [...formData.keys()].filter((k) => k.startsWith('check-kind-'));
  if (kindKeys.length === 0) {
    return dataRouter(
      { error: 'No submission kinds selected, a collection needs as least 1' },
      { status: 400 },
    );
  }
  const kindIds = kindKeys.map((k) => k.split('check-kind-')[1]);

  const prisma = await getPrismaClient();
  const existing = await prisma.collection.findFirst({ where: { id: payload.id } });
  if (existing?.default && !payload.default) {
    return dataRouter({ error: 'Cannot unset default collection' }, { status: 400 });
  }

  const data = {
    ...payload,
    name,
    slug: payload.slug?.toLowerCase() ?? '',
    title: payload.title,
    workflow: ctx.site.private ? 'PRIVATE' : payload.workflow,
    description: payload.description,
    open: payload.open,
    default: payload.default,
    parent_id: parentId === 'none' ? null : parentId,
  };

  await dbEditCollection(ctx.site.name, data, kindIds);

  const items = await dbListCollections(ctx.site.id);
  return { ok: true, items };
}
