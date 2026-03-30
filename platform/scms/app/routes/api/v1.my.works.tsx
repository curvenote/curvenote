/**
 * `GET /v1/my/works` — list works for the authenticated user.
 *
 * **Query parameters** (optional filters; omit both to list all):
 *
 * - **`key`** — Curvenote work key (`Work.key`). Returns works whose `key` matches exactly.
 * - **`cdn-key`** — Value stored on a work version (`WorkVersion.cdn_key`), e.g. an `at://` URI
 *   for AT Protocol–linked content. Returns works you have access to that have **at least one**
 *   version with this `cdn_key`. The value must be **URL-encoded** in the request (e.g.
 *   `encodeURIComponent('at://did:plc:…/…')`). The response shape is the same as for `key`:
 *   `{ items: WorkDTO[], links: { self } }`, with each item reflecting the matching version
 *   when filtered by `cdn-key`.
 *
 * **Errors**
 *
 * - **`400`** if both `key` and `cdn-key` are supplied — use only one filter.
 */
import type { Route } from './+types/v1.my.works';
import { httpError } from '@curvenote/scms-core';
import { withAPISecureContext, my } from '@curvenote/scms-server';

/** See module documentation for `GET /v1/my/works` query parameters (`key`, `cdn-key`). */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const url = new URL(args.request.url);
  const key = url.searchParams.get('key');
  const cdnKey = url.searchParams.get('cdn-key');
  if (key && cdnKey) {
    return httpError(400, 'Specify only one of key or cdn-key');
  }
  const filters =
    key && key.length > 0
      ? { key }
      : cdnKey && cdnKey.length > 0
        ? { cdnKey }
        : undefined;
  const dto = await my.works.list(ctx, filters);
  return Response.json(dto);
}
