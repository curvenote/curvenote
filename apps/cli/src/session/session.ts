import fetch from 'node-fetch';
import type { Store } from 'redux';
import { createStore } from 'redux';
import type { Logger } from 'myst-cli-utils';
import { LogLevel, basicLogger } from 'myst-cli-utils';
import { loadConfigOrThrow } from '../config';
import { CURVENOTE_YML } from '../config/types';
import type { RootState } from '../store';
import { rootReducer, selectors } from '../store';
import { checkForClientVersionRejection } from '../utils';
import { getHeaders, setSessionOrUserToken } from './tokens';
import type { ISession, Response, Tokens } from './types';

const DEFAULT_API_URL = 'https://api.curvenote.com';
const DEFAULT_SITE_URL = 'https://curvenote.com';

export type SessionOptions = {
  apiUrl?: string;
  siteUrl?: string;
  logger?: Logger;
};

function withQuery(url: string, query: Record<string, string> = {}) {
  const params = Object.entries(query ?? {})
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (params.length === 0) return url;
  return url.indexOf('?') === -1 ? `${url}?${params}` : `${url}&${params}`;
}

export function loadAllConfigs(session: Pick<ISession, 'log' | 'store'>) {
  try {
    loadConfigOrThrow(session, '.');
    session.log.debug(`Loaded configs from "./${CURVENOTE_YML}"`);
  } catch (error) {
    // TODO: what error?
    session.log.debug(`Failed to find or load configs from "./${CURVENOTE_YML}"`);
  }
  const siteConfig = selectors.selectLocalSiteConfig(session.store.getState());
  if (!siteConfig?.projects) return;
  siteConfig.projects
    .filter((project) => project.path !== '.') // already loaded
    .forEach((project) => {
      try {
        if (project.path) loadConfigOrThrow(session, project.path);
      } catch (error) {
        // TODO: what error?
        session.log.debug(
          `Failed to find or load project config from "${project.path}/${CURVENOTE_YML}"`,
        );
      }
    });
}

export class Session implements ISession {
  API_URL: string;

  SITE_URL: string;

  $tokens: Tokens = {};

  store: Store<RootState>;

  $logger: Logger;

  get log(): Logger {
    return this.$logger;
  }

  get isAnon() {
    return !(this.$tokens.user || this.$tokens.session);
  }

  constructor(token?: string, opts: SessionOptions = {}) {
    this.$logger = opts.logger ?? basicLogger(LogLevel.info);
    const url = this.setToken(token);
    this.API_URL = opts.apiUrl ?? url ?? DEFAULT_API_URL;
    this.SITE_URL = opts.siteUrl ?? DEFAULT_SITE_URL;
    if (this.API_URL !== DEFAULT_API_URL) {
      this.log.warn(`Connecting to API at: "${this.API_URL}".`);
    }
    this.store = createStore(rootReducer);
    loadAllConfigs({ log: this.$logger, store: this.store });
  }

  setToken(token?: string) {
    const { tokens, url } = setSessionOrUserToken(this.log, token);
    this.$tokens = tokens;
    return url;
  }

  reload() {
    loadAllConfigs({ log: this.$logger, store: this.store });
  }

  async get<T extends Record<string, any>>(
    url: string,
    query?: Record<string, string>,
  ): Response<T> {
    const withBase = url.startsWith(this.API_URL) ? url : `${this.API_URL}${url}`;
    const fullUrl = withQuery(withBase, query);
    const headers = await getHeaders(this.log, this.$tokens);
    this.log.debug(`GET ${url}`);
    const response = await fetch(fullUrl, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
    const json = await response.json();
    checkForClientVersionRejection(this.log, response.status, json);
    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  }

  async patch<T extends Record<string, any>>(url: string, data: Record<string, any>) {
    return this.post<T>(url, data, 'patch');
  }

  async post<T extends Record<string, any>>(
    url: string,
    data: Record<string, any>,
    method: 'post' | 'patch' = 'post',
  ): Response<T> {
    if (url.startsWith(this.API_URL)) url = url.replace(this.API_URL, '');
    const headers = await getHeaders(this.log, this.$tokens);
    this.log.debug(`${method.toUpperCase()} ${url}`);
    const response = await fetch(`${this.API_URL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
    });
    const json = await response.json();
    if (!response.ok) {
      const dataString = JSON.stringify(json, null, 2);
      this.log.debug(`${method.toUpperCase()} FAILED ${url}: ${response.status}\n\n${dataString}`);
    }
    checkForClientVersionRejection(this.log, response.status, json);
    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  }
}
