import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { formatZodError, TAG_LABEL_MAX_LENGTH, TrackEvent } from '@curvenote/scms-core';
import { sites, type SiteContextWithUser } from '@curvenote/scms-server';

/**
 * `httpError` rejects with a `Response`, which carries its reason in
 * `statusText` and has no `message`. Without this the caller's 400 and 404
 * reasons collapse into the generic fallback.
 */
function errorMessage(e: any, fallback: string): string {
  if (e instanceof Response) {
    return e.statusText || fallback;
  }
  return e?.message ?? fallback;
}

const assignSchema = zfd.formData({
  submission_id: zfd.text(z.uuid()),
  tag_id: zfd.text(z.uuid()).optional(),
  label: zfd.text(z.string().min(1).max(TAG_LABEL_MAX_LENGTH)).optional(),
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
    const { tag, changed } = await sites.tags.assignTagToSubmission({
      siteId: ctx.site.id,
      submissionId: submission_id,
      userId: ctx.user.id,
      input: tag_id ? { tagId: tag_id } : { label: label as string },
    });

    // Only a real assignment is tracked, so the analytics stream and the
    // SUBMISSION_TAGS_CHANGE activity log stay in step on redundant calls.
    if (changed) {
      await ctx.trackEvent(TrackEvent.SUBMISSION_TAGS_CHANGED, {
        submissionId: submission_id,
        tagId: tag.id,
        tagName: tag.name,
        action: 'added',
      });
      await ctx.analytics.flush();
    }

    return { tag };
  } catch (e: any) {
    return data({ error: errorMessage(e, 'could not assign tag') }, { status: e.status ?? 500 });
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
    const { tag, changed } = await sites.tags.removeTagFromSubmission({
      siteId: ctx.site.id,
      submissionId: submission_id,
      userId: ctx.user.id,
      tagId: tag_id,
    });

    if (changed) {
      await ctx.trackEvent(TrackEvent.SUBMISSION_TAGS_CHANGED, {
        submissionId: submission_id,
        tagId: tag.id,
        tagName: tag.name,
        action: 'removed',
      });
      await ctx.analytics.flush();
    }

    return { tag };
  } catch (e: any) {
    return data({ error: errorMessage(e, 'could not remove tag') }, { status: e.status ?? 500 });
  }
}
