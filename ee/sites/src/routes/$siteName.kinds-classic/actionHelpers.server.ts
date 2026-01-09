import { data as dataRouter } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient, assertUserDefined, userHasScope, sites } from '@curvenote/scms-server';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import { site as siteScopes } from '@curvenote/scms-core';
import { dbCreateKind, dbListSubmissionKinds, dbSubmissionKindExists } from './db.server.js';

const CreateKindSchemaObject = {
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
  default: zfd.checkbox({ trueValue: 'default' }),
};

export async function $actionKindCreate(ctx: SiteContext, formData: FormData) {
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, siteScopes.kinds.create, ctx.site.name))
    return dataRouter(
      { error: "you don't have permission to create a submission kind (unauthorized)" },
      { status: 401 },
    );

  const CreateKindSchema = zfd.formData(CreateKindSchemaObject);
  let payload;
  try {
    payload = CreateKindSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return dataRouter({ error: error?.issues ?? error }, { status: 400 });
  }

  const name = payload.name.toLowerCase();
  const exists = await dbSubmissionKindExists(ctx.site.name, { name });
  if (exists) {
    return dataRouter(
      { error: 'Submission Kind already exists, names must be unique' },
      { status: 400 },
    );
  }

  const data = {
    ...payload,
    name: payload.name.toLowerCase(),
    checks: sites.DEFAULT_CHECKS,
  };

  await dbCreateKind(ctx.site.name, data);

  const items = await dbListSubmissionKinds(ctx.site.id);
  return { ok: true, items };
}

export async function $actionKindEdit(ctx: SiteContext, formData: FormData) {
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, siteScopes.kinds.update, ctx.site.name))
    return dataRouter(
      { error: "you don't have permission to update a submission kind (unauthorized)" },
      { status: 401 },
    );

  const UpdateKindSchema = zfd.formData({
    ...CreateKindSchemaObject,
    id: zfd.text(z.uuid()),
  });
  let payload: z.infer<typeof UpdateKindSchema>;
  try {
    payload = UpdateKindSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return dataRouter({ error: error?.issues ?? error }, { status: 400 });
  }

  const prisma = await getPrismaClient();
  const existing = await prisma.submissionKind.findFirst({
    where: {
      id: payload.id,
    },
  });

  if (!existing) {
    return dataRouter({ error: 'Submission Kind does not exist, cannot update' }, { status: 400 });
  }

  if (
    payload.default === existing.default &&
    payload.description === ((existing.content as any)?.description ?? '') &&
    payload.title === ((existing.content as any)?.title ?? '') &&
    payload.name === existing.name
  ) {
    return { ok: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.submissionKind.update({
      where: {
        id: payload.id,
      },
      data: {
        content: {
          title: payload.title,
          description: payload.description,
        },
        default: payload.default,
        name: payload.name,
        date_modified: new Date().toISOString(),
      },
    });

    if (payload.default) {
      await tx.submissionKind.updateMany({
        where: {
          site: {
            id: ctx.site.id,
          },
          id: {
            not: payload.id,
          },
        },
        data: {
          default: false,
        },
      });
    }
  });

  return { ok: true };
}

export async function $actionKindDelete(ctx: SiteContext, formData: FormData) {
  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, siteScopes.kinds.delete, ctx.site.name))
    return dataRouter(
      { error: "you don't have permission to delete a submission kind (unauthorized)" },
      { status: 401 },
    );

  const deleteKindSchema = zfd.formData({
    id: zfd.text(z.uuid()),
  });

  let payload: { id: string };
  try {
    payload = deleteKindSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return dataRouter({ error: error?.issues ?? error }, { status: 400 });
  }

  const exists = await dbSubmissionKindExists(ctx.site.name, { id: payload.id });
  if (!exists) {
    return dataRouter({ error: 'Collection does not exist! cannot delete' }, { status: 400 });
  }

  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.submissionKind.delete({
      where: {
        id: payload.id,
      },
    });

    if (deleted.default) {
      const newDefault = await tx.submissionKind.findFirst({
        where: {
          site: {
            id: ctx.site.id,
          },
        },
      });
      if (newDefault) {
        await tx.submissionKind.update({
          where: {
            id: newDefault.id,
          },
          data: {
            default: true,
            date_modified: new Date().toISOString(),
          },
        });
      }
    }
  });

  return { ok: true };
}
