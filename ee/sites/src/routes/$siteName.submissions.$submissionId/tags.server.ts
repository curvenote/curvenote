import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { formatZodError, TrackEvent } from '@curvenote/scms-core';
import { sites, type SiteContextWithUser } from '@curvenote/scms-server';

const assignSchema = zfd.formData({
  submission_id: zfd.text(z.uuid()),
  tag_id: zfd.text(z.uuid()).optional(),
  label: zfd.text(z.string().min(1)).optional(),
});

const removeSchema = zfd.formData({
  submission_id: zfd.text(z.uuid()),
  tag_id: zfd.text(z.uuid()),
});

export async function actionAssignTag(ctx: SiteContextWithUser, formData: FormData) {
  let payload;
  try {
    payload = assignSchema.parse(formData);
  } catch (e: any) {
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, tag_id, label } = payload;
  if (!tag_id && !label) {
    return data({ error: 'tag_id or label is required' }, { status: 400 });
  }

  try {
    const tag = await sites.tags.assignTagToSubmission({
      siteId: ctx.site.id,
      submissionId: submission_id,
      userId: ctx.user.id,
      input: tag_id ? { tagId: tag_id } : { label: label as string },
    });

    await ctx.trackEvent(TrackEvent.SUBMISSION_TAGS_CHANGED, {
      submissionId: submission_id,
      tagId: tag.id,
      tagName: tag.name,
      action: 'added',
    });
    await ctx.analytics.flush();

    return { tag };
  } catch (e: any) {
    return data({ error: e.message ?? 'could not assign tag' }, { status: e.status ?? 500 });
  }
}

export async function actionRemoveTag(ctx: SiteContextWithUser, formData: FormData) {
  let payload;
  try {
    payload = removeSchema.parse(formData);
  } catch (e: any) {
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, tag_id } = payload;

  try {
    const tag = await sites.tags.removeTagFromSubmission({
      siteId: ctx.site.id,
      submissionId: submission_id,
      userId: ctx.user.id,
      tagId: tag_id,
    });

    await ctx.trackEvent(TrackEvent.SUBMISSION_TAGS_CHANGED, {
      submissionId: submission_id,
      tagId: tag.id,
      tagName: tag.name,
      action: 'removed',
    });
    await ctx.analytics.flush();

    return { tag };
  } catch (e: any) {
    return data({ error: e.message ?? 'could not remove tag' }, { status: e.status ?? 500 });
  }
}
