import type { Route } from './+types/v1.sites.$siteName.submissions';
import { z } from 'zod';
import {
  ensureJsonBodyFromMethod,
  validate,
  withSecureSiteContext,
  userHasScope,
  sites,
} from '@curvenote/scms-server';
import { error401, httpError, scopes } from '@curvenote/scms-core';
import type { SubmissionKindDTO } from '@curvenote/common';
import { extensions } from '../../extensions/server';

const ListParamsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(500),
  page: z.number().int().min(0).optional(),
});

const CreateSubmissionPostBodySchema = z.object({
  work_version_id: z.uuid(),
  kind: z.string().min(1).max(255).optional(), // TODO deprecate in favor of kind_id
  kind_id: z.uuid().optional(),
  draft: z.boolean().optional(),
  job_id: z.uuid().optional(),
  collection_id: z.uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  if (ctx.site.external) {
    throw httpError(405, 'External sites do not accept submissions');
  }

  if (!ctx.authorized.curvenote) throw httpError(401, 'Unauthorized');
  if (!userHasScope(ctx.user, scopes.site.submissions.list, ctx.site.name)) {
    throw error401();
  }
  const url = new URL(args.request.url);
  const key = url.searchParams.get('key');
  const collectionIdOrSlug = url.searchParams.get('collection');
  const { limit, page } = validate(ListParamsSchema, {
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
    page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : undefined,
  });
  const dto = await sites.submissions.list(
    ctx,
    extensions,
    {
      work: key ? { is: { key } } : undefined,
      collection: collectionIdOrSlug
        ? {
            OR: [{ id: collectionIdOrSlug }, { slug: collectionIdOrSlug }],
          }
        : undefined,
    },
    (page ?? 0) * limit,
    limit,
  );

  return Response.json(dto);
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withSecureSiteContext(args);
  if (ctx.site.external) {
    throw httpError(405, 'External sites do not accept submissions');
  }

  if (args.request.method !== 'POST') throw httpError(405, 'Method Not Allowed');

  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);

  const {
    work_version_id,
    kind: kindName,
    kind_id,
    draft,
    job_id,
    collection_id,
    metadata,
  } = validate(CreateSubmissionPostBodySchema, body);

  // validate that the requested kind is included in the collection specific or the default collection
  const collection = collection_id
    ? await sites.collections.get(ctx, { id: collection_id })
    : await sites.collections.get(ctx, { default: true });

  if (!collection) {
    console.error(`Collection ${collection_id} does not exist`);
    throw httpError(400, `Collection specified does not exist`);
  } else if (!collection.open) {
    console.error(`Collection ${collection_id} is not open`);
    throw httpError(422, `Collection specified is not open`);
  }

  // TODO move all this validation and defaulting into the .create method?
  // start deprecating kind in favor of kind_id, begin accepting kind_id
  let kindDto: SubmissionKindDTO | null = null;
  if (kind_id) {
    kindDto = await sites.kinds.get(ctx, { id: kind_id });
  } else if (kindName) {
    kindDto = await sites.kinds.get(ctx, { name: kindName });
  } else {
    const collectionKind = collection.kinds.find((k) => k.default) ?? collection.kinds[0];
    kindDto = await sites.kinds.get(ctx, { id: collectionKind.id });
  }

  if (kindDto == null) throw httpError(400, `Specified kind does not exist`);

  if (!collection.kinds.find((k) => k.id === kindDto?.id)) {
    console.error(
      `Specified kind (${kind_id}, ${kindName}) is not accepted in the collection ${collection.content.title ?? collection.slug}`,
    );
    throw httpError(
      400,
      `Specified kind is not accepted in the collection ${collection.content.title ?? collection.slug}`,
    );
  }

  try {
    const dto = await sites.submissions.create(
      ctx,
      extensions,
      work_version_id,
      kindDto.id,
      draft ?? false,
      job_id,
      collection.id,
      metadata,
    );
    return Response.json(dto, { status: 201 });
  } catch (error: any) {
    console.error('422', error.message);
    throw httpError(422, `Could not create a new submission - ${error.message}`);
  }
}
