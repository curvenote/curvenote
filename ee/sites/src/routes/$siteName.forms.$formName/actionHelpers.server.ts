import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { scopes } from '@curvenote/scms-core';
import { withValidFormData, userHasSiteScope } from '@curvenote/scms-server';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import {
  safeFormContentUpdate,
  dbUpdateFormName,
  dbUpdateFormKind,
  dbCreateFormCollection,
  dbDeleteFormCollection,
  dbDeleteForm,
} from './db.server.js';
import { getPrismaClient } from '@curvenote/scms-server';
import { z } from 'zod';

const UpdateFormTitleSchema = zfd.formData({
  value: zfd.text(z.string().min(1).max(64)),
});

const UpdateFormDescriptionSchema = zfd.formData({
  value: zfd.text(z.string().min(1).max(1024)),
});

const UpdateFormNameSchema = zfd.formData({
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

const UpdateFormKindSchema = zfd.formData({
  value: zfd.text(z.string()),
});

const UpdateFormCollectionSchema = zfd.formData({
  value: zfd.text().transform((value) => (value === 'true' ? true : false)),
  data: zfd.text(z.string()),
});

export async function updateFormTitle(
  ctx: SiteContextWithUser,
  formId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateFormTitleSchema,
    formData,
    async ({ value }) => {
      return safeFormContentUpdate({ title: value }, formId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-form-title' } },
  );
}

export async function updateFormDescription(
  ctx: SiteContextWithUser,
  formId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateFormDescriptionSchema,
    formData,
    async ({ value }) => {
      return safeFormContentUpdate({ description: value }, formId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-form-description' } },
  );
}

export async function updateFormName(
  ctx: SiteContextWithUser,
  formId: string,
  formData: FormData,
) {
  return withValidFormData(
    UpdateFormNameSchema,
    formData,
    async ({ value }) => {
      const updatedForm = await dbUpdateFormName(value, formId, ctx.user.id);
      return updatedForm;
    },
    { errorFields: { type: 'general', intent: 'update-form-name' } },
  );
}

export async function updateFormKind(
  ctx: SiteContextWithUser,
  formId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateFormKindSchema,
    formData,
    async ({ value }) => {
      return dbUpdateFormKind(value, formId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-form-kind' } },
  );
}

export async function updateFormCollection(
  ctx: SiteContextWithUser,
  formId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateFormCollectionSchema,
    formData,
    async ({ value, data: collectionId }) => {
      if (value) {
        return dbCreateFormCollection(collectionId, formId, ctx.user.id);
      } else {
        // Check if this is the last collection
        const prisma = await getPrismaClient();
        const form = await prisma.submissionForm.findUnique({
          where: { id: formId },
          include: {
            collections: true,
          },
        });

        if (!form) {
          return data({ error: { message: 'Form not found' } }, { status: 404 });
        }

        if (form.collections.length <= 1) {
          return data(
            { error: { message: 'At least one collection must be selected' } },
            { status: 400 },
          );
        }

        return dbDeleteFormCollection(collectionId, formId, ctx.user.id);
      }
    },
    { errorFields: { type: 'general', intent: 'update-form-collection' } },
  );
}

export async function deleteForm(ctx: SiteContextWithUser, formId: string) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.delete, ctx.site.id)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const result = await dbDeleteForm(formId, ctx.user.id);
    return result;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: any) {
    return data(
      {
        error: {
          type: 'general',
          intent: 'delete-form',
          message: 'Unable to delete',
        },
      },
      { status: 400 },
    );
  }
}

