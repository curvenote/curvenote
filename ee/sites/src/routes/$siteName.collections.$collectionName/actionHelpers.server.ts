import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { scopes } from '@curvenote/scms-core';
import { withValidFormData, userHasSiteScope } from '@curvenote/scms-server';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import {
  dbDeleteCollection,
  dbUpdateCollectionDefault,
  dbUpdateCollectionName,
  safeCollectionContentUpdate,
  dbCreateCollectionKind,
  dbDeleteCollectionKind,
  dbUpdateCollectionOpen,
  dbUpdateCollectionParent,
} from './db.server.js';
import { z } from 'zod';

const UpdateCollectionTitleSchema = zfd.formData({
  value: zfd.text(z.string().min(1).max(64)),
});

const UpdateCollectionDescriptionSchema = zfd.formData({
  value: zfd.text(z.string().min(1).max(1024)),
});

const UpdateCollectionNameSchema = zfd.formData({
  value: zfd.text(
    z
      .string()
      .min(1)
      .max(64)
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-_]+$/)
      .transform((v: string) => v.replace(/\s+/g, '-')),
  ),
});

const UpdateCollectionKindSchema = zfd.formData({
  value: zfd.text().transform((value) => (value === 'true' ? true : false)),
  data: zfd.text(z.string()),
});

const UpdateCollectionOpenSchema = zfd.formData({
  value: zfd.text().transform((value) => (value === 'true' ? true : false)),
});

const UpdateCollectionDefaultSchema = zfd.formData({
  value: zfd.text().transform((value) => (value === 'true' ? true : false)),
});

const UpdateCollectionParentSchema = zfd.formData({
  value: zfd.text().transform((value) => (value === 'none' ? null : value)),
});

export async function updateCollectionTitle(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateCollectionTitleSchema,
    formData,
    async ({ value }) => {
      return safeCollectionContentUpdate({ title: value }, collectionId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-collection-title' } },
  );
}

export async function updateCollectionDescription(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateCollectionDescriptionSchema,
    formData,
    async ({ value }) => {
      return safeCollectionContentUpdate({ description: value }, collectionId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-collection-description' } },
  );
}

export async function updateCollectionName(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  return withValidFormData(
    UpdateCollectionNameSchema,
    formData,
    async ({ value }) => {
      const updatedCollection = await dbUpdateCollectionName(value, collectionId, ctx.user.id);
      return updatedCollection;
    },
    { errorFields: { type: 'general', intent: 'update-collection-name' } },
  );
}

export async function updateCollectionKind(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateCollectionKindSchema,
    formData,
    async ({ value, data: kindId }) => {
      if (value) {
        return dbCreateCollectionKind(kindId, collectionId, ctx.user.id);
      } else {
        return dbDeleteCollectionKind(kindId, collectionId, ctx.user.id);
      }
    },
    { errorFields: { type: 'general', intent: 'update-collection-kind' } },
  );
}

export async function updateCollectionOpen(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateCollectionOpenSchema,
    formData,
    async ({ value }) => {
      return dbUpdateCollectionOpen(value, collectionId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-collection-open' } },
  );
}

export async function updateCollectionDefault(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateCollectionDefaultSchema,
    formData,
    async ({ value }) => {
      return dbUpdateCollectionDefault(value, collectionId, ctx.site.id, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-collection-default' } },
  );
}

export async function updateCollectionParent(
  ctx: SiteContextWithUser,
  collectionId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateCollectionParentSchema,
    formData,
    async ({ value }) => {
      return dbUpdateCollectionParent(value, collectionId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-collection-parent' } },
  );
}

export async function deleteCollection(ctx: SiteContextWithUser, collectionId: string) {
  if (!userHasSiteScope(ctx.user, scopes.site.collections.delete, ctx.site.id)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const result = await dbDeleteCollection(collectionId, ctx.user.id);
    return result;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: any) {
    return data(
      {
        error: {
          type: 'general',
          intent: 'delete-collection',
          message: 'Unable to delete',
        },
      },
      { status: 400 },
    );
  }
}
