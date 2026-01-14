import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { withValidFormData, userHasSiteScope } from '@curvenote/scms-server';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import { dbCreateForm, dbFormExists } from './db.server.js';
import { deleteForm } from '../$siteName.forms.$formName/actionHelpers.server.js';
import { z } from 'zod';

const DeleteFormSchema = zfd.formData({
  formId: zfd.text(z.uuid()),
});

const CreateFormSchema = zfd.formData({
  name: zfd.text(
    z
      .string()
      .min(1)
      .max(64)
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-_]+$/)
      .transform((v: string) => v.replace(/\s+/g, '-')),
  ),
  title: zfd.text(z.string().min(1).max(64)),
  description: zfd.text(z.string().min(1).max(1024).optional()),
});

export async function deleteFormAction(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.delete, ctx.site.id)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }
  return withValidFormData(
    DeleteFormSchema,
    formData,
    async ({ formId }) => {
      return deleteForm(ctx, formId);
    },
    { errorFields: { type: 'general', intent: 'delete-form' } },
  );
}

export async function createForm(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.forms.create, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    CreateFormSchema,
    formData,
    async ({ title, name, description }) => {
      // Check if name already exists
      const nameExists = await dbFormExists(ctx.site.id, name);
      if (nameExists) {
        return data({ error: { message: 'Form name must be unique' } }, { status: 400 });
      }

      // Get default kind
      const defaultKind = ctx.site.submissionKinds.find((k) => k.default);
      if (!defaultKind) {
        return data({ error: { message: 'No default kind found for site' } }, { status: 400 });
      }

      // Get default collection
      const defaultCollection = ctx.site.collections.find((c) => c.default);
      const collectionIds = defaultCollection ? [defaultCollection.id] : [];

      return dbCreateForm(
        {
          title,
          name,
          description,
          kindId: defaultKind.id,
          collectionIds,
        },
        ctx.site.id,
        ctx.user.id,
      );
    },
    { errorFields: { type: 'general', intent: 'create-form' } },
  );
}
