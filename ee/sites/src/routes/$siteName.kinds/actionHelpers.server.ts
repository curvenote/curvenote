import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { withValidFormData, userHasSiteScope } from '@curvenote/scms-server';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import { dbCreateKind, dbDeleteKind } from './db.server.js';
import { z } from 'zod';

const DeleteKindSchema = zfd.formData({
  kindId: zfd.text(z.uuid()),
});

const CreateKindSchema = zfd.formData({
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

export async function deleteKind(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.delete, ctx.site.id)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }
  return withValidFormData(
    DeleteKindSchema,
    formData,
    async ({ kindId }) => {
      return dbDeleteKind(kindId, ctx.site.id, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'delete-kind' } },
  );
}

export async function createKind(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.create, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    CreateKindSchema,
    formData,
    async ({ title, name, description }) => {
      return dbCreateKind({ title, name, description }, ctx.site.id, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'create-kind' } },
  );
}
