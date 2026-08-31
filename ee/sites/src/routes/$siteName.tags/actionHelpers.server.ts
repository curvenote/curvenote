import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { TAG_LABEL_MAX_LENGTH, formatZodError, scopes } from '@curvenote/scms-core';
import { sites, userHasSiteScope, type SiteContextWithUser } from '@curvenote/scms-server';

function errorMessage(e: any, fallback: string): string {
  if (e instanceof Response) {
    return e.statusText || fallback;
  }
  return e?.message ?? fallback;
}

function errorStatus(e: any, fallback: number): number {
  if (e instanceof Response) {
    return e.status;
  }
  return e?.status ?? fallback;
}

const CreateTagSchema = zfd.formData({
  label: zfd.text(z.string().min(1).max(TAG_LABEL_MAX_LENGTH)),
});

export async function createTag(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.tags.create, ctx.site.id)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }

  let payload;
  try {
    payload = CreateTagSchema.parse(formData);
  } catch (e: any) {
    return data({ error: { field: 'label', message: formatZodError(e) } }, { status: 400 });
  }

  try {
    const tag = await sites.tags.createSiteTag({
      siteId: ctx.site.id,
      label: payload.label,
    });
    return { tag };
  } catch (e: any) {
    const status = errorStatus(e, 500);
    const message = errorMessage(e, 'could not create tag');
    if (status === 400) {
      return data({ error: { field: 'label', message } }, { status });
    }
    return data({ error: message }, { status });
  }
}

const UpdateTagSchema = zfd.formData({
  tagId: zfd.text(z.uuid()),
  label: zfd.text(z.string().min(1).max(TAG_LABEL_MAX_LENGTH)),
});

export async function updateTag(ctx: SiteContextWithUser, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.tags.update, ctx.site.id)) {
    return data({ error: 'Forbidden' }, { status: 403 });
  }

  let payload;
  try {
    payload = UpdateTagSchema.parse(formData);
  } catch (e: any) {
    return data({ error: { field: 'label', message: formatZodError(e) } }, { status: 400 });
  }

  try {
    const tag = await sites.tags.updateSiteTagLabel({
      siteId: ctx.site.id,
      tagId: payload.tagId,
      label: payload.label,
    });
    return { tag };
  } catch (e: any) {
    const status = errorStatus(e, 500);
    const message = errorMessage(e, 'could not update tag');
    if (status === 400) {
      return data({ error: { field: 'label', message } }, { status });
    }
    return data({ error: message }, { status });
  }
}
