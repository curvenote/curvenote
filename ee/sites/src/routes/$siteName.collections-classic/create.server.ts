import { data } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { assertUserDefined, userHasScope } from '@curvenote/scms-server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { site as siteScopes } from '@curvenote/scms-core';
import {
  dbCollectionExists,
  dbCreateCollection,
  dbListCollections,
} from '../$siteName.collections/db.server.js';

export const CreateCollectionSchemaObject = {
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
  slug: zfd.text(
    z
      .string()
      .min(1)
      .max(64)
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-_\s]+$/)
      .transform((v) => v.replace(/\s+/g, '-'))
      .optional(),
  ),
  workflow: zfd.text(
    z.union([
      z.literal('SIMPLE'),
      z.literal('PRIVATE'),
      z.literal('OPEN_REVIEW'),
      z.literal('CLOSED_REVIEW'),
    ]),
  ),
  title: zfd.text(z.string().min(1).max(64)),
  description: zfd.text(z.string().min(1).max(1024).optional()),
  open: zfd.checkbox({ trueValue: 'open' }),
  default: zfd.checkbox({ trueValue: 'default' }),
  parent: zfd.text(z.string().min(1)),
};

export async function $actionCollectionCreate(ctx: SiteContext, formData: FormData) {
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, siteScopes.collections.create, ctx.site.name))
    return data(
      { error: "you don't have permission to create a collection (unauthorized)" },
      { status: 401 },
    );

  const CreateCollectionSchema = zfd.formData(CreateCollectionSchemaObject);
  let payload;
  try {
    payload = CreateCollectionSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return data({ error: error?.issues ?? error }, { status: 400 });
  }

  const { parent: parentId } = payload;
  const name = payload.name.toLowerCase();
  const exists = await dbCollectionExists(ctx.site.name, { name });
  if (exists) {
    return data({ error: 'Collection already exists, names must be unique' }, { status: 400 });
  }

  // TODO validate parent exists
  const kindKeys = [...formData.keys()].filter((k) => k.startsWith('check-kind-'));
  if (kindKeys.length === 0) {
    return data(
      { error: 'No submission kinds selected, a collection needs as least 1' },
      { status: 400 },
    );
  }
  const kindIds = kindKeys.map((k) => k.split('check-kind-')[1]);

  const collection = {
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

  await dbCreateCollection(ctx.site.name, collection, kindIds);

  const items = await dbListCollections(ctx.site.id);
  return { items };
}
