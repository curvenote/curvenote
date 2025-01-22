import path from 'node:path';
import type { Store } from 'redux';
import { createStore } from 'redux';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { RequestInfo, RequestInit, Request, Response as FetchResponse } from 'node-fetch';
import { default as nodeFetch } from 'node-fetch';
import type { Limit } from 'p-limit';
import pLimit from 'p-limit';
import type { BuildWarning } from 'myst-cli';
import latestVersion from 'latest-version';
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
// use the version mystjs brings in!
// eslint-disable-next-line import/no-extraneous-dependencies
import { KernelManager, ServerConnection, SessionManager } from '@jupyterlab/services';
import type { JupyterServerSettings } from 'myst-execute';
import { findExistingJupyterServer, launchJupyterServer } from 'myst-execute';
import type { JsonObject } from '@curvenote/blocks';
import type { RootState } from '../store/index.js';
import { rootReducer } from '../store/index.js';
import { decodeTokenAndCheckExpiry } from './tokens.js';
import type {
  ValidatedCurvenotePlugin,
  ISession,
  Response,
  Tokens as TokenPair,
  Token,
  CLIConfigData,
} from './types.js';
import { XClientName } from '@curvenote/blocks';
import CLIENT_VERSION from '../version.js';
import { loadProjectPlugins } from './plugins.js';
import { combinePlugins, getBuiltInPlugins } from './builtinPlugins.js';
import { logUpdateRequired } from './utils.js';
import jwt from 'jsonwebtoken';
import chalk from 'chalk';

const DEFAULT_EDITOR_API_URL = 'https://api.curvenote.com';
const DEFAULT_PLATFORM_API_URL = 'https://sites.curvenote.com/v1/';
const DEFAULT_EDITOR_URL = 'https://curvenote.com';

const STAGING_PLATFORM_API_URL = 'https://sites.curvenote.dev/v1/';
const STAGING_EDITOR_API_URL = 'https://api.curvenote.one';
const STAGING_EDITOR_URL = 'https://curvenote.one';

const LOCAL_EDITOR_API_URL = 'http://localhost:8083';
const LOCAL_PLATFORM_API_URL = 'http://localhost:3031/v1/';
const LOCAL_EDITOR_URL = 'http://localhost:3000';

const LOCALHOSTS = ['localhost', '127.0.0.1', '::1'];

const CONFIG_FILES = ['curvenote.yml', 'myst.yml'];

export type SessionOptions = {
  apiUrl?: string;
  siteUrl?: string;
  logger?: Logger;
  doiLimiter?: Limit;
};

function withQuery(url: string, query: Record<string, string> = {}) {
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
function checkForCurvenoteAPIClientVersionRejection(
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
function checkForPlatformAPIClientVersionRejection(log: Logger, response: FetchResponse) {
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

/**
 * makeDefaultConfig cerate the fallback configuration which only needs to be valid for
 * the case where the user token was created on the legacy API
 *
 * @param session
 * @param opts
 * @returns
 */
function makeDefaultConfig(audience: string, log: Logger): CLIConfigData {
  let apiUrl = DEFAULT_PLATFORM_API_URL;
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
    editorApiUrl = STAGING_EDITOR_API_URL;
    editorUrl = STAGING_PLATFORM_API_URL;
    privateCdnUrl = 'https://prv.curvenote.dev';
    tempCdnUrl = 'https://tmp.curvenote.dev';
    publicCdnUrl = 'https://cdn.curvenote.dev';
  } else if (
    audience.startsWith(LOCAL_EDITOR_API_URL) ||
    audience.startsWith(LOCAL_PLATFORM_API_URL)
  ) {
    apiUrl = LOCAL_PLATFORM_API_URL;
    editorApiUrl = LOCAL_EDITOR_API_URL;
    editorUrl = LOCAL_EDITOR_URL;
    privateCdnUrl = 'https://prv.curvenote.dev';
    tempCdnUrl = 'https://tmp.curvenote.dev';
    publicCdnUrl = 'https://cdn.curvenote.dev';
  }

  if (editorApiUrl !== DEFAULT_EDITOR_API_URL) {
    log.warn(`Connecting to API at: "${editorApiUrl}".`);
  }
  if (editorUrl !== DEFAULT_EDITOR_URL) {
    log.warn(`Connecting to Site at: "${editorUrl}".`);
  }
  if (apiUrl !== DEFAULT_PLATFORM_API_URL) {
    log.warn(`Connecting to Sites API at: "${apiUrl}".`);
    log.warn(`Using public cdn at: "${publicCdnUrl}".`);
    log.warn(`Using private cdn at: "${privateCdnUrl}".`);
  }

  return {
    apiUrl,
    editorApiUrl,
    editorUrl,
    privateCdnUrl,
    tempCdnUrl,
    publicCdnUrl,
  };
}

export class Session implements ISession {
  $config?: CLIConfigData;
  $activeTokens: TokenPair = {};
  $logger: Logger;
  API_URL: string;
  SITE_URL: string;
  configFiles: string[];

  store: Store<RootState>;

  doiLimiter: Limit;
  plugins: ValidatedCurvenotePlugin | undefined;

  proxyAgent?: HttpsProxyAgent<string>;
  _shownUpgrade = false;
  _latestVersion?: string;
  _jupyterSessionManagerPromise?: Promise<SessionManager | undefined>;

  get log(): Logger {
    return this.$logger;
  }

  get isAnon() {
    return !(this.$activeTokens.user || this.$activeTokens.session);
  }

  get config(): CLIConfigData {
    if (!this.$config) throw new Error('No config set on session');
    return this.$config;
  }

  get activeTokens(): TokenPair {
    return this.$activeTokens;
  }

  static async create(token?: string, opts: SessionOptions = {}) {
    const session = new Session(opts);

    if (token) {
      const { decoded } = decodeTokenAndCheckExpiry(token, session.$logger, false);
      session.log.debug('Creating session with token (decoded):');
      session.log.debug(JSON.stringify(decoded, null, 2));

      session.setUserToken({ token, decoded });
      await session.refreshSessionToken();
      await session.fetchConfig();
    }

    return session;
  }

  private constructor(opts: SessionOptions = {}) {
    this.configFiles = CONFIG_FILES;
    this.$logger = opts.logger ?? basicLogger(LogLevel.info);
    this.doiLimiter = opts.doiLimiter ?? pLimit(3);
    const proxyUrl = process.env.HTTPS_PROXY;
    if (proxyUrl) {
      this.log.warn(`Using HTTPS proxy: ${proxyUrl}`);
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
    }

    this.API_URL = 'INVALID';
    this.SITE_URL = 'INVALID';

    this.store = createStore(rootReducer);
    // Allow the latest version to be loaded
    latestVersion('curvenote')
      .then((latest) => {
        this._latestVersion = latest;
      })
      .catch(() => null);
  }

  setUserToken(token: Token) {
    this.$activeTokens.user = token;
  }

  async refreshSessionToken() {
    if (!this.$activeTokens.user) {
      if (!this.$activeTokens.session) {
        throw new Error('No user or session token to refresh.');
      }
      const { expired } = decodeTokenAndCheckExpiry(this.$activeTokens.session.token, this.log);
      if (expired === 'soon') {
        this.log.debug('Session token will expire soon.');
      } else if (expired) {
        throw new Error('Session token is expired and no user token provided.');
      }
      return; // no user token, nothing left to do
    }

    // There is a user token, meaning refresh is possible
    if (this.$activeTokens.session) {
      // check current session token
      const { expired } = decodeTokenAndCheckExpiry(
        this.$activeTokens.session.token,
        this.log,
        false, // don't throw if expired
      );
      if (expired === 'soon') this.log.debug('SessionToken: The session token will expire soon.');
      if (expired) this.log.debug('SessionToken: The session token has expired.');
      if (expired === 'soon' || expired) {
        this.$activeTokens.session = undefined;
      } else return; // no need to refresh
    }

    // Request a new session token
    this.log.debug('SessionToken: requesting a new session token.');
    const {
      decoded: { aud },
    } = this.$activeTokens.user;
    try {
      const response = await this.fetch(aud as string, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.$activeTokens.user.token}`,
        },
      });
      if (!response.ok) {
        this.log.debug(`Response: ${response.status} ${response.statusText}`);
        throw new Error(`SessionToken: The user token is not valid.`);
      }
      const json = (await response.json()) as { session?: string };
      if (!json.session)
        throw new Error(
          "SessionToken: There was an error in the response, expected a 'session' in the JSON object.",
        );
      const decoded = jwt.decode(json.session) as Token['decoded'];
      this.$activeTokens.session = { token: json.session, decoded };
      this.log.debug('SessionToken: new session token created.');
      this.log.debug('SessionToken payload:');
      this.log.debug(JSON.stringify(decoded, null, 2));
    } catch (error) {
      this.log.error(
        `⛔️ There was a problem with your API token or the API at ${aud} is unreachable.`,
      );
      this.log.error(
        'If the error persists try generating a new token or contact support@curvenote.com.',
      );
      this.log.debug(chalk.red(error));
      throw new Error('Could not refresh session token');
    }
  }

  async getHeaders() {
    const headers: Record<string, string> = {
      'X-Client-Name': XClientName.javascript,
      'X-Client-Version': CLIENT_VERSION,
    };
    this.refreshSessionToken();
    if (this.$activeTokens.session) {
      headers.Authorization = `Bearer ${this.$activeTokens.session.token}`;
    }
    return headers;
  }

  async fetchConfig() {
    if (!this.$activeTokens.session?.decoded.aud) return;
    const { aud } = this.$activeTokens.session.decoded;
    const audience = Array.isArray(aud)
      ? aud[0]
      : (this.$activeTokens.session.decoded.aud as string);
    this.$config = makeDefaultConfig(audience, this.log);

    this.log.debug(`Configuration set: "${JSON.stringify(this.$config, null, 2)}".`);

    return;
    // if (!decoded?.cfg) {
    //   this.log.debug('No cfg claim found in token payload');
    //   this.$config = makeDefaultConfig();
    //   return;
    // }

    // fetch the config from the API
  }

  showUpgradeNotice() {
    if (this._shownUpgrade || !this._latestVersion || CLIENT_VERSION === this._latestVersion)
      return;
    this.log.info(
      logUpdateAvailable({
        current: CLIENT_VERSION,
        latest: this._latestVersion,
        upgradeCommand: 'npm i -g curvenote@latest',
        twitter: 'curvenote',
      }),
    );
    this._shownUpgrade = true;
  }

  _clones: ISession[] = [];

  async clone() {
    const cloneSession = new Session({
      logger: this.log,
      apiUrl: this.$config?.apiUrl,
      siteUrl: this.$config?.editorUrl,
      doiLimiter: this.doiLimiter,
    });
    cloneSession.$config = this.$config;
    await cloneSession.reload();
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

  async reload() {
    await findCurrentProjectAndLoad(this, '.');
    await findCurrentSiteAndLoad(this, '.');
    if (selectors.selectCurrentSitePath(this.store.getState())) {
      await reloadAllConfigsForCurrentSite(this);
    }
    return this;
  }

  async fetch(url: URL | RequestInfo, init?: RequestInit): Promise<FetchResponse> {
    const urlOnly = new URL((url as Request).url ?? (url as URL | string));
    this.log.debug(`Fetching: ${urlOnly}`);
    if (this.proxyAgent && !LOCALHOSTS.includes(urlOnly.hostname)) {
      if (!init) init = {};
      init = { agent: this.proxyAgent, ...init };
      this.log.debug(`Using HTTPS proxy: ${this.proxyAgent.proxy}`);
    }
    const logData = { url: urlOnly, done: false };
    setTimeout(() => {
      if (!logData.done) this.log.info(`⏳ Waiting for response from ${url}`);
    }, 5000);
    const resp = await nodeFetch(url, init);
    logData.done = true;
    checkForPlatformAPIClientVersionRejection(this.log, resp);
    return resp;
  }

  _pluginPromise: Promise<ValidatedCurvenotePlugin> | undefined;

  async loadPlugins(): Promise<ValidatedCurvenotePlugin> {
    // Early return if a promise has already been initiated
    if (this._pluginPromise) return this._pluginPromise;
    this._pluginPromise = loadProjectPlugins(this);
    const loadedPlugins = await this._pluginPromise;
    this.plugins = combinePlugins([getBuiltInPlugins(), loadedPlugins]);
    return this.plugins;
  }

  async get<T extends Record<string, any>>(
    url: string,
    query?: Record<string, string>,
  ): Response<T> {
    if (!this.$config) throw new Error('Cannot make API requests without an authenticated session');
    const parsed = new URL(url, this.$config.apiUrl); // allow origins from caller
    const fullUrl = withQuery(parsed.toString(), query);
    const headers = await this.getHeaders();
    this.log.debug(`GET ${url}`);
    const response = await this.fetch(fullUrl, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
    const json = (await response.json()) as any;
    checkForCurvenoteAPIClientVersionRejection(this.log, response, json);
    checkForPlatformAPIClientVersionRejection(this.log, response);
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
    if (!this.$config) throw new Error('Cannot make API requests without an authenticated session');
    const parsed = new URL(url, this.$config.apiUrl); // allow origins from caller
    const fullUrl = parsed.toString();
    const headers = await this.getHeaders();
    this.log.debug(`${method.toUpperCase()} ${fullUrl}`);
    const response = await this.fetch(fullUrl, {
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
    checkForCurvenoteAPIClientVersionRejection(this.log, response, json);
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
        const existing = await findExistingJupyterServer(this);
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
