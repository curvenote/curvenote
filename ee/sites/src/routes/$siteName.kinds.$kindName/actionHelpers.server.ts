import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { withValidFormData, userHasSiteScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import {
  dbAddKindCheck,
  dbRemoveKindCheck,
  dbUpdateKindCheckOption,
  dbUpdateKindCheckOptional,
  dbUpdateKindDefault,
  dbUpdateKindName,
  safeKindContentUpdate,
} from './db.server.js';
import { z } from 'zod';

const UpdateKindTitleSchema = zfd.formData({
  value: zfd.text(z.string().min(1).max(64)),
});

const UpdateKindDescriptionSchema = zfd.formData({
  value: zfd.text(z.string().min(1).max(1024)),
});

const UpdateKindNameSchema = zfd.formData({
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

const UpdateKindDefaultSchema = zfd.formData({
  value: zfd.text().transform((value) => (value === 'true' ? true : false)),
});

const UpdateKindCheckEnabledSchema = zfd.formData({
  enabled: zfd.text().transform((value) => (value === 'true' ? true : false)),
  checkId: zfd.text(z.string()),
  order: zfd.text().transform((value) => value.split(',')),
});

const UpdateKindCheckOptionSchema = zfd.formData({
  checkId: zfd.text(z.string()),
  optionId: zfd.text(z.string()),
  value: zfd.text(z.string().optional()),
});

const UpdateKindCheckOptionalSchema = zfd.formData({
  checkId: zfd.text(z.string()),
  optional: zfd.text().transform((value) => (value === 'warn' ? true : false)),
});

export async function updateKindTitle(
  ctx: SiteContextWithUser,
  kindId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindTitleSchema,
    formData,
    async ({ value }) => {
      return safeKindContentUpdate({ title: value }, kindId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-kind-title' } },
  );
}

export async function updateKindDescription(
  ctx: SiteContextWithUser,
  kindId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindDescriptionSchema,
    formData,
    async ({ value }) => {
      return safeKindContentUpdate({ description: value }, kindId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-kind-description' } },
  );
}

export async function updateKindName(ctx: SiteContextWithUser, kindId: string, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindNameSchema,
    formData,
    async ({ value }) => {
      return dbUpdateKindName(value, kindId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-kind-name' } },
  );
}

export async function updateKindDefault(
  ctx: SiteContextWithUser,
  kindId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindDefaultSchema,
    formData,
    async ({ value }) => {
      return dbUpdateKindDefault(value, kindId, ctx.site.id, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-kind-default' } },
  );
}

export async function updateKindCheckEnabled(
  ctx: SiteContextWithUser,
  kindId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindCheckEnabledSchema,
    formData,
    async ({ enabled, checkId, order }) => {
      if (enabled) {
        return dbAddKindCheck(checkId, kindId, ctx.user.id, order);
      } else {
        return dbRemoveKindCheck(checkId, kindId, ctx.user.id, order);
      }
    },
    { errorFields: { type: 'general', intent: 'update-kind-check-enabled' } },
  );
}

export async function updateKindCheckOption(
  ctx: SiteContextWithUser,
  kindId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindCheckOptionSchema,
    formData,
    async ({ checkId, optionId, value }) => {
      if (value == null) return null;
      return dbUpdateKindCheckOption(checkId, optionId, value, kindId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-kind-check-option' } },
  );
}

export async function updateKindCheckOptional(
  ctx: SiteContextWithUser,
  kindId: string,
  formData: FormData,
) {
  if (!userHasSiteScope(ctx.user, scopes.site.kinds.update, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }
  return withValidFormData(
    UpdateKindCheckOptionalSchema,
    formData,
    async ({ checkId, optional }) => {
      return dbUpdateKindCheckOptional(checkId, optional, kindId, ctx.user.id);
    },
    { errorFields: { type: 'general', intent: 'update-kind-check-optional' } },
  );
}
