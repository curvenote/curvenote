import type { Route } from './+types/v1.checks.$checkId.docs';
import { withContext } from '@curvenote/scms-server';

const DOCS_SITE = 'https://checks.curvenote.com/';

function api404(message = 'No API route found at this URL') {
  return Response.json({ status: 404, message }, { status: 404 });
}

export async function loader(args: Route.LoaderArgs) {
  await withContext(args);
  const { checkId } = args.params;
  if (!checkId) return api404();
  const resp = await fetch(`${DOCS_SITE}${checkId}.json`);
  if (!resp.ok) return api404();
  const json = await resp.json();
  return Response.json(json);
}
