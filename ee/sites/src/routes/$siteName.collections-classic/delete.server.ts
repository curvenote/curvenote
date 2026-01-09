import { getPrismaClient, assertUserDefined, userHasScope } from '@curvenote/scms-server';
import { data } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { site as siteScopes } from '@curvenote/scms-core';
import { dbCollectionExists } from '../$siteName.collections/db.server.js';

export async function $actionCollectionDelete(ctx: SiteContext, formData: FormData) {
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, siteScopes.collections.delete, ctx.site.name))
    return data(
      { error: "you don't have permission to delete a collection (unauthorized)" },
      { status: 401 },
    );

  const deleteCollectionSchema = zfd.formData({
    id: zfd.text(z.uuid()),
  });

  // TODO some better error return/handling that we can use across the app!
  // for both zod and simple plain text errors that we throw directly
  let payload: { id: string };
  try {
    payload = deleteCollectionSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return data({ error: error?.issues ?? error }, { status: 400 });
  }

  const exists = await dbCollectionExists(ctx.site.name, { id: payload.id });
  if (!exists) {
    return data({ error: 'Collection does not exist! cannot delete' }, { status: 400 });
  }

  const prisma = await getPrismaClient();
  const items = await prisma.$transaction(async (tx) => {
    await tx.kindsInCollections.deleteMany({
      where: {
        collection_id: payload.id,
      },
    });

    const deleted = await tx.collection.delete({
      where: {
        id: payload.id,
      },
    });

    if (deleted.default) {
      const newDefault = await tx.collection.findFirst({
        where: {
          site: {
            id: ctx.site.id,
          },
        },
      });
      if (newDefault) {
        await tx.collection.update({
          where: {
            id: newDefault.id,
          },
          data: {
            default: true,
            date_modified: new Date().toISOString(),
          },
        });
      }
    }
  });

  return { items };
}
