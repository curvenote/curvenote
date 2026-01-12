import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '@curvenote/scms-server';
import { isSafeSlug, looksLikeUUID, formatZodError, TrackEvent } from '@curvenote/scms-core';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { ActivityType } from '@prisma/client';
import type { SiteContextWithUser } from '@curvenote/scms-server';

export async function actionSetPrimarySlug(
  ctx: SiteContextWithUser,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const slug_id = formData.get('slug_id') as string | null;
  if (slug_id == null) {
    return data({ error: 'invalid slug_id' }, { status: 400 });
  }

  console.log(args.request.method, 'setting slug as primary');
  const prisma = await getPrismaClient();
  const dbo = await prisma.slug.findUnique({ where: { id: slug_id } });
  if (!dbo) return data({ error: 'slug not found' }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      const timestamp = new Date().toISOString();
      await tx.slug.update({
        where: { id: slug_id },
        data: {
          primary: true,
          date_modified: timestamp,
        },
      });

      await tx.slug.updateMany({
        where: {
          submission_id: args.params.submissionId,
          id: {
            not: slug_id,
          },
          primary: true,
        },
        data: {
          primary: false,
          date_modified: timestamp,
        },
      });
    });
  } catch (e: any) {
    return data({ error: 'could not remove slug', message: e.message }, { status: 500 });
  }

  const slugs = await prisma.slug.findMany({
    where: {
      submission_id: args.params.submissionId,
    },
    orderBy: [{ date_created: 'desc' }],
  });

  await ctx.trackEvent(TrackEvent.SUBMISSION_SLUG_SET_AS_PRIMARY, {
    submissionId: args.params.submissionId,
    slugId: slug_id,
    slug: dbo.slug,
  });

  await ctx.analytics.flush();

  return { slugs };
}

export async function actionDeleteSlug(
  ctx: SiteContextWithUser,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const slug_id = formData.get('slug_id') as string | null;
  if (slug_id == null) {
    return data({ error: 'invalid slug_id' }, { status: 400 });
  }

  console.log(args.request.method, 'removing a slug');

  const prisma = await getPrismaClient();
  const dbo = await prisma.slug.findUnique({ where: { id: slug_id } });
  if (!dbo) return data({ error: 'slug not found' }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.slug.delete({
        where: { id: slug_id },
      });

      if (dbo.primary) {
        // reassign primary to most recent slug
        const mostRecent = await tx.slug.findFirst({ orderBy: { date_created: 'desc' } });
        if (mostRecent) {
          await tx.slug.update({
            where: { id: mostRecent?.id },
            data: { primary: true, date_modified: new Date().toISOString() },
          });
        } // else there are no more slugs
      }
    });
  } catch (e: any) {
    return data({ error: 'could not remove slug', message: e.message }, { status: 500 });
  }

  const slugs = await prisma.slug.findMany({
    where: {
      submission_id: args.params.submissionId,
    },
    orderBy: [{ date_created: 'desc' }],
  });

  await ctx.trackEvent(TrackEvent.SUBMISSION_SLUG_DELETED, {
    submissionId: args.params.submissionId,
    slugId: slug_id,
    slug: dbo.slug,
    wasPrimary: dbo.primary,
  });

  await ctx.analytics.flush();

  return { slugs };
}

export async function actionAddSlug(
  ctx: SiteContextWithUser,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const slug = formData.get('slug') as string | null;

  if (slug == null) {
    return data({ error: 'missing slug' }, { status: 400 });
  }
  if (slug.length < 6) {
    return data({ error: `stub too short, ${slug.length} chars (min 6)` }, { status: 400 });
  }
  if (slug.length > 64) {
    return data({ error: `stub too long, ${slug.length} chars (max 64)` }, { status: 400 });
  }

  const submissionId = formData.get('submission_id') as string | null;
  if (submissionId == null) {
    return data({ error: 'missing submission_id' }, { status: 400 });
  }
  if (!looksLikeUUID(submissionId)) {
    return data({ error: 'invalid submission_id' }, { status: 400 });
  }

  const siteId = formData.get('site_id') as string | null;
  if (siteId == null) {
    return data({ error: 'missing site_id' }, { status: 400 });
  }
  if (!looksLikeUUID(siteId)) {
    return data({ error: 'invalid site_id' }, { status: 400 });
  }

  const prisma = await getPrismaClient();
  const exists = await prisma.slug.findFirst({
    where: {
      slug,
      site: {
        id: siteId,
      },
    },
  });

  if (exists) {
    if (exists.submission_id !== submissionId) {
      return data({
        error: 'slug already in use on another submission',
        submission_id: exists.submission_id,
        slug,
      });
    }
    return data({ error: 'slug already in use here', slug });
  }

  if (looksLikeUUID(slug)) {
    return data({ error: 'cannot use uuids as slugs' }, { status: 400 });
  }
  if (!isSafeSlug(slug)) {
    return data(
      { error: 'invalid characters in slug (use alphanumeric, "-", "_" or "." only)' },
      { status: 400 },
    );
  }
  const isWork = await prisma?.work.findUnique({ where: { id: slug } });
  const isSubmission = await prisma?.submission.findUnique({ where: { id: slug } });
  if (isWork || isSubmission) {
    return data({ error: 'cannot set slug as ', slug });
  }

  const slugs = await prisma.$transaction(async (tx) => {
    const timestamp = new Date().toISOString();
    await tx.slug.create({
      data: {
        id: uuidv7(),
        slug,
        date_created: timestamp,
        date_modified: timestamp,
        submission: {
          connect: {
            id: args.params.submissionId!,
          },
        },
        site: {
          connect: {
            id: siteId,
          },
        },
        primary: true,
      },
    });

    await tx.slug.updateMany({
      where: {
        submission_id: submissionId,
        slug: {
          not: slug,
        },
        primary: true,
      },
      data: {
        primary: false,
      },
    });

    return tx.slug.findMany({
      where: { submission_id: submissionId },
      orderBy: [{ date_created: 'desc' }],
    });
  });

  await ctx.trackEvent(TrackEvent.SUBMISSION_SLUG_ADDED, {
    submissionId: submissionId,
    slug: slug,
  });

  await ctx.analytics.flush();

  return { slugs };
}

export async function actionSetKind(
  ctx: SiteContextWithUser,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const setKindSchema = zfd.formData({
    kind_id: zfd.text(z.uuid()),
    collection_id: zfd.text(z.uuid()),
    submission_id: zfd.text(z.uuid()),
  });

  let payload;
  try {
    payload = setKindSchema.parse(formData);
  } catch (e: any) {
    console.error(`Invalid form data ${e}`);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, kind_id, collection_id } = payload;

  const prisma = await getPrismaClient();
  const dbo = await prisma.collection.findUnique({
    where: { id: collection_id },
    include: {
      kindsInCollection: true,
    },
  });
  if (!dbo) return data({ error: 'collection not found' }, { status: 404 });

  if (!dbo.kindsInCollection.some((kic) => kic.kind_id === kind_id)) {
    console.error('Selected kind is not in collection');
    return data({ error: 'Selected kind is not in collection' }, { status: 400 });
  }

  const updated = await prisma.submission.update({
    where: { id: submission_id },
    data: {
      kind_id: kind_id,
      date_modified: new Date().toISOString(),
    },
    include: {
      kind: true,
    },
  });

  await ctx.trackEvent(TrackEvent.SUBMISSION_KIND_CHANGED, {
    submissionId: submission_id,
    kindId: kind_id,
    kindName: updated.kind.name,
    collectionId: collection_id,
  });

  await ctx.analytics.flush();

  return { kindName: updated.kind.name, kindId: updated.kind.id };
}

export async function actionSetCollection(
  ctx: SiteContextWithUser,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const setKindSchema = zfd.formData({
    submission_id: zfd.text(z.uuid()),
    collection_id: zfd.text(z.uuid()),
  });

  let payload;
  try {
    payload = setKindSchema.parse(formData);
  } catch (e: any) {
    console.error(`Invalid form data ${e}`);
    console.error(e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, collection_id } = payload;

  const prisma = await getPrismaClient();
  const dbo = await prisma.collection.findUnique({
    where: { id: collection_id },
    include: {
      kindsInCollection: true,
    },
  });
  if (!dbo) return data({ error: 'collection not found' }, { status: 404 });

  const updated = await prisma.submission.update({
    where: { id: submission_id },
    data: {
      collection_id,
      date_modified: new Date().toISOString(),
    },
    include: {
      collection: true,
    },
  });

  await ctx.trackEvent(TrackEvent.SUBMISSION_COLLECTION_CHANGED, {
    submissionId: submission_id,
    collectionId: collection_id,
    collectionName: updated.collection.name,
  });

  await ctx.analytics.flush();

  return { collection: updated.collection };
}

export async function actionUpdateDatePublished(
  ctx: SiteContextWithUser,
  args: ActionFunctionArgs,
  formData: FormData,
  userId: string,
) {
  const updateDatePublishedSchema = zfd.formData({
    date_published: zfd.text(z.iso.date()),
    submission_id: zfd.text(z.uuid()),
  });

  let payload;
  try {
    payload = updateDatePublishedSchema.parse(formData);
  } catch (e: any) {
    console.error(`Invalid form data ${e}`);
    console.error(e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { submission_id, date_published } = payload;

  const prisma = await getPrismaClient();
  const dbo = await prisma.submission.findUnique({
    where: { id: submission_id },
  });
  if (!dbo) return data({ error: 'submission not found' }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const timestamp = new Date().toISOString();
    const sub = await tx.submission.update({
      where: { id: submission_id },
      data: {
        date_published,
        date_modified: timestamp,
      },
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: userId,
          },
        },
        submission: {
          connect: {
            id: submission_id,
          },
        },
        activity_type: ActivityType.SUBMISSION_DATE_CHANGE,
        date_published,
      },
      include: {
        activity_by: true,
        kind: true,
      },
    });

    return sub;
  });

  await ctx.trackEvent(TrackEvent.SUBMISSION_DATE_PUBLISHED_CHANGED, {
    submissionId: submission_id,
    datePublished: date_published,
  });

  await ctx.analytics.flush();

  return { date_published: updated.date_published };
}
