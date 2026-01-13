import type { Route } from './+types/v1.config';
import { error401 } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';

type CLIConfigData = {
  apiUrl: string;
  adminUrl: string;
  editorApiUrl: string;
  editorUrl: string;
  privateCdnUrl: string;
  tempCdnUrl: string;
  publicCdnUrl: string;
  deploymentCdnUrl: string;
};

/**
 * A loader function that returns the configuration data for the CLI.
 * Does not require an authenticated user.
 *
 * @param args
 * @returns
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  if (!ctx.user) return error401();

  const apiUrl = ctx.$config.api.url;
  const adminUrl = ctx.$config.app.adminUrl;
  const editorApiUrl = ctx.$config.api.editorApiUrl;
  const editorUrl = ctx.$config.app.editorUrl;
  const privateCdnUrl = ctx.$config.api.knownBucketInfoMap.prv.cdn ?? '';
  const tempCdnUrl = ctx.$config.api.knownBucketInfoMap.tmp.cdn ?? '';
  const publicCdnUrl = ctx.$config.api.knownBucketInfoMap.pub.cdn ?? '';
  const deploymentCdnUrl = ctx.$config.api.knownBucketInfoMap.cdn?.cdn ?? '';

  const dto: CLIConfigData = {
    apiUrl,
    adminUrl,
    editorApiUrl,
    editorUrl,
    privateCdnUrl,
    tempCdnUrl,
    publicCdnUrl,
    deploymentCdnUrl,
  };

  return Response.json(dto);
}
