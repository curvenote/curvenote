import path from 'node:path';
import fetch from 'node-fetch';
import type { Store } from 'redux';
import { createStore } from 'redux';
import type { BuildWarning } from 'myst-cli';
import {
  findCurrentProjectAndLoad,
  findCurrentSiteAndLoad,
  logUpdateAvailable,
  reloadAllConfigsForCurrentSite,
  selectors,
} from 'myst-cli';
import type { Logger } from 'myst-cli-utils';
import { LogLevel, basicLogger } from 'myst-cli-utils';
import type { RuleId } from 'myst-common';
import { KernelManager, ServerConnection, SessionManager } from '@jupyterlab/services';
import type { JupyterServerSettings } from 'myst-execute';
import { findExistingJupyterServer, launchJupyterServer } from 'myst-execute';
import type { RootState } from '../store/index.js';
import { rootReducer } from '../store/index.js';
import { checkForClientVersionRejection } from '../utils/index.js';
import { getHeaders, setSessionOrUserToken } from './tokens.js';
import type { CurvenotePlugin, ISession, Response, Tokens } from './types.js';
import version from '../version.js';
import { loadCurvenotePlugins } from './plugins.js';

const DEFAULT_API_URL = 'https://api.curvenote.com';
const DEFAULT_SITE_URL = 'https://curvenote.com';
const DEFAULT_SITES_API_URL = 'https://sites.curvenote.com/v1/';
const STAGING_SITES_API_URL = 'https://sites.curvenote.dev/v1/';
const STAGING_API_URL = 'https://api.curvenote.one';
const LOCAL_API_URL = 'http://localhost:8083';
const LOCAL_SITE_URL = 'http://localhost:3000';
const LOCAL_SITES_API_URL = 'http://localhost:3031/v1/';

const CONFIG_FILES = ['curvenote.yml', 'myst.yml'];

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

export class Session implements ISession {
  API_URL: string;
  SITE_URL: string;
  JOURNALS_URL: string;
  PUBLIC_CDN: string;
  PRIVATE_CDN: string;
  configFiles: string[];
  $tokens: Tokens = {};
  store: Store<RootState>;
  $logger: Logger;
  plugins: CurvenotePlugin | undefined;

  get log(): Logger {
    return this.$logger;
  }

  get isAnon() {
    return !(this.$tokens.user || this.$tokens.session);
  }

  constructor(token?: string, opts: SessionOptions = {}) {
    this.configFiles = CONFIG_FILES;
    this.$logger = opts.logger ?? basicLogger(LogLevel.info);
    const url = this.setToken(token);
    this.API_URL = opts.apiUrl ?? url ?? DEFAULT_API_URL;
    this.log.debug(`Connecting to API at: "${this.API_URL}".`);
    this.SITE_URL =
      opts.siteUrl ?? (this.API_URL === LOCAL_API_URL ? LOCAL_SITE_URL : DEFAULT_SITE_URL);

    this.JOURNALS_URL = DEFAULT_SITES_API_URL;
    this.PRIVATE_CDN = 'https://prv.curvenote.com';
    this.PUBLIC_CDN = 'https://cdn.curvenote.com';
    if (url?.startsWith(STAGING_API_URL)) {
      this.JOURNALS_URL = STAGING_SITES_API_URL;
      this.PRIVATE_CDN = 'https://prv.curvenote.dev';
      this.PUBLIC_CDN = 'https://cdn.curvenote.dev';
    } else if (url?.startsWith(LOCAL_API_URL)) {
      this.JOURNALS_URL = LOCAL_SITES_API_URL;
      this.PRIVATE_CDN = 'https://prv.curvenote.dev';
      this.PUBLIC_CDN = 'https://cdn.curvenote.dev';
    }

    if (this.API_URL !== DEFAULT_API_URL) {
      this.log.warn(`Connecting to API at: "${this.API_URL}".`);
    }
    if (this.SITE_URL !== DEFAULT_SITE_URL) {
      this.log.warn(`Connecting to Site at: "${this.SITE_URL}".`);
    }
    if (this.JOURNALS_URL !== DEFAULT_SITES_API_URL) {
      this.log.warn(`Connecting to Journals at: "${this.JOURNALS_URL}".`);
      this.log.warn(`Using public cdn at: "${this.PUBLIC_CDN}".`);
      this.log.warn(`Using private cdn at: "${this.PRIVATE_CDN}".`);
    }

    this.store = createStore(rootReducer);
    findCurrentProjectAndLoad(this, '.');
    findCurrentSiteAndLoad(this, '.');
  }

  _shownUpgrade = false;
  _latestVersion?: string;
  _jupyterSessionManagerPromise?: Promise<SessionManager | undefined>;

  showUpgradeNotice() {
    if (this._shownUpgrade || !this._latestVersion || version === this._latestVersion) return;
    this.log.info(
      logUpdateAvailable({
        current: version,
        latest: this._latestVersion,
        upgradeCommand: 'npm i -g curvenote@latest',
        twitter: 'curvenote',
      }),
    );
    this._shownUpgrade = true;
  }

  _clones: ISession[] = [];

  clone() {
    const cloneSession = new Session(this.$tokens?.session ?? this.$tokens?.user, {
      logger: this.log,
      apiUrl: this.API_URL,
      siteUrl: this.SITE_URL,
    });
    // TODO: clean this up through better state handling
    cloneSession._jupyterSessionManagerPromise = this._jupyterSessionManagerPromise;
    this._clones.push(cloneSession);
    return cloneSession;
  }

  getAllWarnings(ruleId: RuleId) {
    const stringWarnings: string[] = [];
    const warnings: (BuildWarning & { file: string })[] = [];
    [this, ...this._clones].forEach((session: ISession) => {
      const sessionWarnings = selectors.selectFileWarningsByRule(session.store.getState(), ruleId);
      sessionWarnings.forEach((warning) => {
        const stringWarning = JSON.stringify(Object.entries(warning).sort());
        if (!stringWarnings.includes(stringWarning)) {
          stringWarnings.push(stringWarning);
          warnings.push(warning);
        }
      });
    });
    return warnings;
  }

  reload() {
    findCurrentProjectAndLoad(this, '.');
    findCurrentSiteAndLoad(this, '.');
    if (selectors.selectCurrentSitePath(this.store.getState())) {
      reloadAllConfigsForCurrentSite(this);
    }
    return this;
  }

  _pluginPromise: Promise<CurvenotePlugin> | undefined;

  async loadPlugins() {
    // Early return if a promise has already been initiated
    if (this._pluginPromise) return this._pluginPromise;
    this._pluginPromise = loadCurvenotePlugins(this);
    this.plugins = await this._pluginPromise;
    return this.plugins;
  }

  setToken(token?: string) {
    const { tokens, url } = setSessionOrUserToken(this.log, token);
    this.$tokens = tokens;
    return url;
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
    const json = (await response.json()) as any;
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
    const json = (await response.json()) as any;
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

  sourcePath(): string {
    const state = this.store.getState();
    const sitePath = selectors.selectCurrentSitePath(state);
    const projectPath = selectors.selectCurrentProjectPath(state);
    const root = sitePath ?? projectPath ?? '.';
    return path.resolve(root);
  }

  buildPath(): string {
    return path.join(this.sourcePath(), '_build');
  }

  sitePath(): string {
    return path.join(this.buildPath(), 'site');
  }

  contentPath(): string {
    return path.join(this.sitePath(), 'content');
  }

  publicPath(): string {
    return path.join(this.sitePath(), 'public');
  }

  jupyterSessionManager(): Promise<SessionManager | undefined> {
    if (this._jupyterSessionManagerPromise === undefined) {
      this._jupyterSessionManagerPromise = this.createJupyterSessionManager();
    }
    return this._jupyterSessionManagerPromise;
  }

  private async createJupyterSessionManager(): Promise<SessionManager | undefined> {
    try {
      let partialServerSettings: JupyterServerSettings | undefined;
      // Load from environment
      if (process.env.JUPYTER_BASE_URL !== undefined) {
        partialServerSettings = {
          baseUrl: process.env.JUPYTER_BASE_URL,
          token: process.env.JUPYTER_TOKEN,
        };
      } else {
        // Load existing running server
        const existing = await findExistingJupyterServer();
        if (existing) {
          this.log.debug(`Found existing server on: ${existing.appUrl}`);
          partialServerSettings = existing;
        } else {
          this.log.debug(`Launching jupyter server on ${this.sourcePath()}`);
          // Create and load new server
          partialServerSettings = await launchJupyterServer(this.sourcePath(), this.log);
        }
      }

      const serverSettings = ServerConnection.makeSettings(partialServerSettings);
      const kernelManager = new KernelManager({ serverSettings });
      const manager = new SessionManager({ kernelManager, serverSettings });

      // Tie the lifetime of the kernelManager and (potential) spawned server to the manager
      manager.disposed.connect(() => {
        kernelManager.dispose();
        partialServerSettings?.dispose?.();
      });
      return manager;
    } catch (err) {
      this.log.error('Unable to instantiate connection to Jupyter Server', err);
      return undefined;
    }
  }

  dispose() {
    if (this._jupyterSessionManagerPromise) {
      this._jupyterSessionManagerPromise.then((manager) => manager?.dispose?.());
      this._jupyterSessionManagerPromise = undefined;
    }
  }
}
