import type { Logger } from 'myst-cli-utils';
import { LogLevel, chalkLogger } from 'myst-cli-utils';
import type { CLIConfigData, ISession, SessionOpts } from './types.js';
import { Session } from './session.js';
import { getTokens } from './auth.js';
import boxen from 'boxen';
import chalk from 'chalk';
import CLIENT_VERSION from '../version.js';
import type { JsonObject } from '@curvenote/blocks';
import type { Response as FetchResponse } from 'node-fetch';

export function logUpdateRequired({
  current,
  minimum,
  upgradeCommand,
  twitter,
}: {
  current: string;
  minimum: string;
  upgradeCommand: string;
  twitter: string;
}) {
  return boxen(
    `Upgrade Required! ${chalk.dim(`v${current}`)} ≫ ${chalk.green.bold(
      `v${minimum} (minimum)`,
    )}\n\nRun \`${chalk.cyanBright.bold(
      upgradeCommand,
    )}\` to update.\n\nFollow ${chalk.yellowBright(
      `@${twitter}`,
    )} for updates!\nhttps://twitter.com/${twitter}`,
    {
      padding: 1,
      margin: 1,
      borderColor: 'red',
      borderStyle: 'round',
      textAlignment: 'center',
    },
  );
}

/**
 * Duplicated from myst-cli-utils, where function is not exported
 */
function getLogLevel(level: LogLevel | boolean | string = LogLevel.info): LogLevel {
  if (typeof level === 'number') return level;
  const useLevel: LogLevel = level ? LogLevel.debug : LogLevel.info;
  return useLevel;
}

export async function anonSession(opts?: SessionOpts): Promise<ISession> {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const session = await Session.create(undefined, { logger });
  return session;
}

export async function getSession(
  opts?: SessionOpts & { hideNoTokenWarning?: boolean },
): Promise<ISession> {
  const logger = chalkLogger(getLogLevel(opts?.debug), process.cwd());
  const data = getTokens(logger);
  if (!data.current && !opts?.hideNoTokenWarning) {
    logger.warn('No token was found in settings or CURVENOTE_TOKEN. Session is not authenticated.');
    logger.info('You can set a new token with: `curvenote token set API_TOKEN`');
    if (data.saved?.length) {
      logger.info('or you can select an existing token with: `curvenote token select`');
    }
  }
  let session;
  try {
    session = await Session.create(data.current, { logger });
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }
  return session;
}

const DEFAULT_PLATFORM_API_URL = 'https://sites.curvenote.com/v1';
const DEFAULT_PLATFORM_APP_URL = 'https://sites.curvenote.com';
const DEFAULT_EDITOR_API_URL = 'https://api.curvenote.com';
const DEFAULT_EDITOR_URL = 'https://curvenote.com';

const STAGING_PLATFORM_API_URL = 'https://sites.curvenote.dev/v1';
const STAGING_PLATFORM_APP_URL = 'https://sites.curvenote.dev';
const STAGING_EDITOR_API_URL = 'https://api.curvenote.one';
const STAGING_EDITOR_URL = 'https://curvenote.one';

const LOCAL_PLATFORM_API_URL = 'http://localhost:3031/v1';
const LOCAL_PLATFORM_APP_URL = 'http://localhost:3031';
const LOCAL_EDITOR_API_URL = 'http://localhost:8083';
const LOCAL_EDITOR_URL = 'http://localhost:3000';

/**
 * makeDefaultConfig cerate the fallback configuration which only needs to be valid for
 * the case where the user token was created on the legacy API
 *
 * @param session
 * @param opts
 * @returns
 */
export function makeDefaultConfig(audience: string): CLIConfigData {
  let apiUrl = DEFAULT_PLATFORM_API_URL;
  let adminUrl = DEFAULT_PLATFORM_APP_URL;
  let editorApiUrl = DEFAULT_EDITOR_API_URL;
  let editorUrl = DEFAULT_EDITOR_URL;
  let privateCdnUrl = 'https://prv.curvenote.com';
  let tempCdnUrl = 'https://tmp.curvenote.com';
  let publicCdnUrl = 'https://cdn.curvenote.com';

  if (
    audience.startsWith(STAGING_EDITOR_API_URL) ||
    audience.startsWith(STAGING_PLATFORM_API_URL)
  ) {
    apiUrl = STAGING_PLATFORM_API_URL;
    adminUrl = STAGING_PLATFORM_APP_URL;
    editorApiUrl = STAGING_EDITOR_API_URL;
    editorUrl = STAGING_EDITOR_URL;
    privateCdnUrl = 'https://prv.curvenote.dev';
    tempCdnUrl = 'https://tmp.curvenote.dev';
    publicCdnUrl = 'https://cdn.curvenote.dev';
  } else if (
    audience.startsWith(LOCAL_EDITOR_API_URL) ||
    audience.startsWith(LOCAL_PLATFORM_API_URL)
  ) {
    apiUrl = LOCAL_PLATFORM_API_URL;
    adminUrl = LOCAL_PLATFORM_APP_URL;
    editorApiUrl = LOCAL_EDITOR_API_URL;
    editorUrl = LOCAL_EDITOR_URL;
    privateCdnUrl = 'https://prv.curvenote.dev';
    tempCdnUrl = 'https://tmp.curvenote.dev';
    publicCdnUrl = 'https://cdn.curvenote.dev';
  }

  return {
    apiUrl,
    adminUrl,
    editorApiUrl,
    editorUrl,
    privateCdnUrl,
    tempCdnUrl,
    publicCdnUrl,
  };
}

export function ensureBaseUrl(url: string, baseUrl: string) {
  try {
    const u = new URL(url);
    return u.toString();
  } catch (e: any) {
    const ub = new URL(`${baseUrl}${url}`);
    return ub.toString();
  }
}

export function withQuery(url: string, query: Record<string, string> = {}) {
  const params = Object.entries(query ?? {})
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (params.length === 0) return url;
  return url.indexOf('?') === -1 ? `${url}?${params}` : `${url}&${params}`;
}

/**
 * This requires the body to be decoded as json and so is called later in the response handling chain
 *
 * @param log
 * @param response
 * @param body
 */
export function checkForCurvenoteAPIClientVersionRejection(
  log: Logger,
  response: FetchResponse,
  body: JsonObject,
) {
  // Check for client version rejection api.curvenote.com
  if (response.status === 400) {
    log.debug(`Request failed: ${JSON.stringify(body)}`);
    if (body?.errors?.[0].code === 'outdated_client') {
      logUpdateRequired({
        current: CLIENT_VERSION,
        minimum: 'latest',
        upgradeCommand: 'npm i -g curvenote@latest',
        twitter: 'curvenote',
      });
    }
  }
}

/**
 * This should be called immedately after the fetch
 *
 * @param log
 * @param response
 */
export function checkForPlatformAPIClientVersionRejection(log: Logger, response: FetchResponse) {
  // Check for client version rejection sites.curvenote.com
  if (response.status === 403) {
    const minimum = response.headers.get('x-minimum-client-version');
    if (minimum != null) {
      log.debug(response.statusText);
      log.error(
        logUpdateRequired({
          current: CLIENT_VERSION,
          minimum,
          upgradeCommand: 'npm i -g curvenote@latest',
          twitter: 'curvenote',
        }),
      );
      process.exit(1);
    }
  }
}
