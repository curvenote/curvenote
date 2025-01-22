import type { CLIConfigData } from '../types.js';

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
