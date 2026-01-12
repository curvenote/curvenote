import { httpError } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-core';
import semver from 'semver';

const CLIENT_NAME_HEADER = `x-client-name`;
const CLIENT_VERSION_HEADER = `x-client-version`;
const MINIMUM_VERSION_RESPONSE_HEADER = `x-minimum-client-version`;
const CURVENOTE_CLIENT_NAME = 'Curvenote Javascript Client';
const CURVENOTE_CLIENT_MINIMUM_VERSION = '0.12.10';

export async function throwOnMinimumCurvenoteClientVersion(ctx: Context, request: Request) {
  const clientName = request.headers.get(CLIENT_NAME_HEADER);
  const clientVersion = request.headers.get(CLIENT_VERSION_HEADER);
  if (clientName && clientVersion && clientName === CURVENOTE_CLIENT_NAME) {
    if (!semver.gte(clientVersion, CURVENOTE_CLIENT_MINIMUM_VERSION)) {
      throw httpError(
        403,
        `Client version ${clientVersion} is too old, please update to ${CURVENOTE_CLIENT_MINIMUM_VERSION}`,
        undefined,
        { headers: { [MINIMUM_VERSION_RESPONSE_HEADER]: CURVENOTE_CLIENT_MINIMUM_VERSION } },
      );
    }
  }
}
