import fetch from 'node-fetch';
import { doi } from 'doi-utils';
import type { SiteManifest } from 'myst-config';
import {
  type PageLoader,
  getFooterLinks,
  getProject,
  updatePageStaticLinksInplace,
  updateSiteManifestStaticLinksInplace,
} from '@myst-theme/common';
import type { Host, SiteDTO, WorkDTO, HostSpec, SiteWorkListingDTO } from '@curvenote/common';
import { responseError, responseNoArticle, responseNoSite } from './errors.server.js';
import type { Cache } from './types.js';

interface CdnRouter {
  cdn?: string; // this is the cdn key
}

export const JOURNALS_API = 'https://journals.curvenote.com/v1/';
export const DEFAULT_CDN = 'https://cdn.curvenote.com/';

/**
 * Performs a lookup of the CDN path on the curvenote api for a given hostname.
 * An optional cache is used to avoid hitting the API too often.
 *
 * @param hostname
 * @param cache
 * @returns
 */
async function getCdnPath(hostname: string, cache?: Cache): Promise<string | undefined> {
  const cached = cache?.get<CdnRouter>('routers', hostname);
  if (cached) return cached.cdn;
  const response = await fetch(`https://api.curvenote.com/routers/${hostname}`);
  if (response.status === 404) {
    // Always hit the API again if it is not found!
    return;
  }
  const data = (await response.json()) as CdnRouter;
  cache?.set<CdnRouter>('routers', hostname, data);
  return data.cdn;
}

function withPublicFolderUrl(baseUrl: string, url: string, query?: string): string {
  return withBaseUrl(`${baseUrl}public`, url, query);
}

/**
 * If host is string, then we need to look up the CDN path (key, uuid)
 * and assume key is on the DEFAULT_CDN, otherwise this function returns
 * the host as-is.
 *
 * @param host
 * @returns
 */
export async function getCdnLocation(host: Host): Promise<HostSpec> {
  if (typeof host === 'string') {
    const key = await getCdnPath(host);
    if (!key) throw responseNoSite();
    return { cdn: DEFAULT_CDN, key }; // TODO: preserve query?
  }
  return host;
}

/**
 * Resolved the CDN base url for a given host. if host is a string, then
 * the CDN path (key, uuid) is looked up and assumed to be on the DEFAULT_CDN,
 *
 * @param host
 * @returns
 */
export async function getCdnBaseUrl(host: Host): Promise<string> {
  const { cdn, key } = await getCdnLocation(host);
  return `${cdn}${key.replace(/\./g, '/')}/`;
}

/**
 * Appends a url to a base url.
 *
 * @param baseUrl
 * @param url
 * @returns
 */
function withBaseUrl<T extends string | undefined>(baseUrl: string, url: T, query?: T): T {
  if (!url) return url;
  if (url.match(/^https?:\/\//)) return url;
  if (query) return `${baseUrl}${url}?${query}` as T;
  return `${baseUrl}${url}` as T;
}

/**
 * Basic comparison for checking that the title and (possible) slug are the same
 */
function foldTitleString(title?: string): string | undefined {
  return title?.replace(/[-\s_]/g, '').toLowerCase();
}

/**
 * If the site title and the first nav item are the same, remove it.
 */
function removeSingleNavItems(config: SiteManifest) {
  if (
    config?.nav?.length === 1 &&
    foldTitleString(config.nav[0].title) === foldTitleString(config.title)
  ) {
    config.nav = [];
  }
}

export async function lookupJournal(
  hostname: string,
  opts?: { cache?: Cache; apiUrl?: string; headers?: Record<string, string> },
): Promise<SiteDTO> {
  const API_URL = opts?.apiUrl ?? JOURNALS_API;
  const data = await requestJournal(hostname, `${API_URL}sites?hostname=${hostname}`, opts);
  if (data.items.length === 0) throw responseNoSite();
  opts?.cache?.set<SiteDTO>('journals', hostname, data);
  return data.items[0] as SiteDTO;
}

export async function getJournal(
  siteName: string,
  opts?: { cache?: Cache; apiUrl?: string; headers?: Record<string, string> },
): Promise<SiteDTO> {
  const API_URL = opts?.apiUrl ?? JOURNALS_API;
  const data = await requestJournal(siteName, `${API_URL}sites/${siteName}`, opts);
  opts?.cache?.set<SiteDTO>('journals', siteName, data);
  return data as SiteDTO;
}

async function requestJournal(
  key: string,
  url: string,
  opts?: { cache?: Cache; apiUrl?: string; headers?: Record<string, string> },
): Promise<any> {
  const cached = opts?.cache?.get<SiteDTO>('journals', key);
  if (cached) return cached;
  const response = await fetch(url, { headers: opts?.headers });
  if (response.status === 404) throw responseNoSite();
  if (!response.ok) throw responseError(response);
  return response.json();
}

/**
 * DEPRECATED: endpoint no longer available
 * TODO: move to site/works/workId endpoint
 * @param workId
 * @param opts
 * @returns
 */
export async function getWork(
  workId: string,
  opts?: { apiUrl?: string; headers?: Record<string, string> },
): Promise<WorkDTO> {
  const API_URL = opts?.apiUrl ?? JOURNALS_API;
  const resp = await fetch(`${API_URL}works/${workId}`, { headers: opts?.headers });
  const data = (await resp.json()) as WorkDTO;
  return data;
}

/**
 * DEPRECATED: endpoint no longer available
 * TODO: move to site/doi endpoint
 * @param doiLookup
 * @param opts
 * @returns
 */
export async function getWorkByDOI(
  doiLookup: string,
  opts?: { apiUrl?: string; headers?: Record<string, string> },
): Promise<WorkDTO> {
  const API_URL = opts?.apiUrl ?? JOURNALS_API;
  const normalized = doi.normalize(doiLookup);
  const resp = await fetch(`${API_URL}doi/${normalized}`, { headers: opts?.headers });
  if (!resp.ok) throw responseError(resp);
  const data = (await resp.json()) as WorkDTO;
  return data;
}

export async function getWorks(
  siteName: string,
  opts?: { apiUrl?: string; headers?: Record<string, string> },
): Promise<SiteWorkListingDTO> {
  const API_URL = opts?.apiUrl ?? JOURNALS_API;
  const resp = await fetch(`${API_URL}sites/${siteName}/works`, { headers: opts?.headers });
  if (!resp.ok) throw responseError(resp);
  const data = (await resp.json()) as SiteWorkListingDTO;
  return data;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export async function getConfig(
  host: Host,
  opts?: { cache?: Cache; bypass?: string },
): Promise<SiteManifest> {
  let response;
  let data;
  if (opts?.bypass) {
    const bypass = ensureTrailingSlash(opts.bypass);
    response = await fetch(`${bypass}config.json`);
    if (response.status === 404) throw responseNoSite();
    if (!response.ok) throw responseError(response);
    data = (await response.json()) as SiteManifest;
    data.id = 'bypass';
    removeSingleNavItems(data);
    updateSiteManifestStaticLinksInplace(data, (url) =>
      withBaseUrl(ensureTrailingSlash(bypass), url),
    );
  } else {
    const location = await getCdnLocation(host);
    const baseUrl = await getCdnBaseUrl(location);
    if (!location.key) throw responseNoSite();
    const key = location.key;
    const cached = opts?.cache?.get<SiteManifest>('config', location.key);
    // Load the data from an in memory cache.
    if (cached) return cached;
    response = await fetch(withBaseUrl(baseUrl, 'config.json', location.query));
    if (response.status === 404) throw responseNoSite();
    if (!response.ok) throw responseError(response);
    data = (await response.json()) as SiteManifest;
    data.id = key;
    removeSingleNavItems(data);
    updateSiteManifestStaticLinksInplace(data, (url) =>
      withPublicFolderUrl(baseUrl, url, location.query),
    );
    opts?.cache?.set<SiteManifest>('config', key, data);
  }

  return data as SiteManifest;
}

export async function getObjectsInv(host: Host): Promise<ArrayBuffer | undefined> {
  const baseUrl = await getCdnBaseUrl(host);
  if (!baseUrl) return;
  const url = `${baseUrl}objects.inv`;
  const response = await fetch(url);
  if (response.status === 404) return;
  if (!response.ok) throw responseError(response);
  const buffer = await response.arrayBuffer();
  return buffer;
}

export async function getMystXrefJson(
  host: Host,
  mount = '',
  opts?: { bypass?: string },
): Promise<Record<string, any> | null> {
  const baseUrl = await getCdnBaseUrl(host);
  if (!baseUrl && !opts?.bypass) return null;
  const url = `${opts?.bypass ? ensureTrailingSlash(opts.bypass) : baseUrl}myst.xref.json`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw responseError(response);
  const xrefs = (await response.json()) as Record<string, any>;
  // The data URLs are remapped for the frontend
  xrefs.references?.forEach((ref: any) => {
    ref.data = ref.data?.replace(/^\/content/, mount);
  });
  return xrefs;
}

export async function getMystSearchJson(
  host: Host,
  opts?: { bypass?: string },
): Promise<Record<string, any> | null> {
  const baseUrl = await getCdnBaseUrl(host);
  if (!baseUrl && !opts?.bypass) return null;
  const url = `${opts?.bypass ? ensureTrailingSlash(opts.bypass) : baseUrl}myst.search.json`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw responseError(response);
  const search = (await response.json()) as Record<string, any>;
  return search;
}

async function getData(
  baseUrl: string,
  config?: SiteManifest,
  project?: string,
  slug?: string,
  query?: string,
  opts?: { bypass?: string },
): Promise<PageLoader | null> {
  if (!slug || !config) throw responseNoArticle();
  const { id } = config;
  if (!id) throw responseNoSite();
  const projectPart = project ? `${project}/` : '';
  const response = opts?.bypass
    ? await fetch(`${ensureTrailingSlash(opts.bypass)}content/${projectPart}${slug}.json`)
    : await fetch(withBaseUrl(baseUrl, `content/${projectPart}${slug}.json`, query));
  if (response.status === 404) throw responseNoArticle();
  if (!response.ok) throw responseError(response);
  const data = (await response.json()) as PageLoader;
  if (opts?.bypass) {
    const bypass = ensureTrailingSlash(opts.bypass);
    return updatePageStaticLinksInplace(data, (url) =>
      withBaseUrl(ensureTrailingSlash(bypass), url, query),
    );
  } else {
    return updatePageStaticLinksInplace(data, (url) => withPublicFolderUrl(baseUrl, url, query));
  }
}

export async function getPage(
  host: Host,
  opts?: {
    domain?: string;
    project?: string;
    loadIndexPage?: boolean;
    slug?: string;
    bypass?: string;
  },
): Promise<PageLoader | null> {
  const projectName = opts?.project;
  const location = await getCdnLocation(host);
  const baseUrl = await getCdnBaseUrl(host);
  const config = await getConfig(location, { bypass: opts?.bypass });
  if (!config) throw responseNoSite();
  const project = getProject(config, projectName);
  if (!project) throw responseNoArticle();
  const slug = opts?.loadIndexPage || opts?.slug == null ? project.index : opts.slug;
  const loader = await getData(baseUrl, config, project.slug, slug, location.query, opts).catch(
    (e) => {
      console.error(e);
      return null;
    },
  );
  if (!loader) throw responseNoArticle();
  const footer = getFooterLinks(config, project.slug, slug);
  return { ...loader, footer, domain: opts?.domain as string, project: project.slug as string };
}

export async function getThumbnailBuffer(host: HostSpec): Promise<ArrayBuffer | undefined> {
  const config = await getConfig(host).catch(() => null);
  if (!config) return;
  const url =
    config.thumbnail ??
    config.projects?.[0].thumbnail ??
    config.projects?.[0].pages.find((p) => p.thumbnail)?.thumbnail;
  if (!url) return;
  const response = await fetch(url);
  if (response.status === 404) return;
  if (!response.ok) throw responseError(response);
  const buffer = await response.arrayBuffer();
  return buffer;
}
