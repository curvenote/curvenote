import type { Route } from './+types/v1.sites.$siteName.kinds.$kindIdOrName';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, validate, sites } from '@curvenote/scms-server';
import { z } from 'zod';

const ParamsSchema = z.object({
  kindIdOrName: z.union([
    z.string().uuid({
      message:
        'Must be a valid UUID or between 3 and 36 characters long and contain only lowercase letters, numbers, hyphens, or underscores',
    }),
    z
      .string()
      .toLowerCase() // TODO this is a temporary lowercase transform to help client migration, aim to remove this
      .regex(/^[a-z0-9-_]{3,36}$/, {
        message:
          'Must be a valid UUID or between 3 and 36 characters long and contain only lowercase letters, numbers, hyphens, or underscores',
      }),
  ]),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const { kindIdOrName } = validate(ParamsSchema, args.params);
  if (!kindIdOrName) throw httpError(400, 'No kindId or name provided');
  const dto = await sites.kinds.get(ctx, { OR: [{ id: kindIdOrName }, { name: kindIdOrName }] });
  if (!dto) throw httpError(404, 'Kind not found');
  return Response.json(dto);
}
