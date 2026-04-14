import type { ServiceManifest } from "@checks-relay/check-plugin-types";
import type { ServiceListItem, ServiceDetailResponse } from "@checks-relay/check-relay-types";

/**
 * Turn a manifest `logo` into an absolute URL when `publicBaseUrl` is configured.
 * Already-absolute `http(s):` logos are unchanged. Root-relative paths (`/assets/...`)
 * are resolved against `publicBaseUrl`.
 */
export function resolvePublicLogo(
  logo: string,
  publicBaseUrl: string | undefined,
): string {
  const base = publicBaseUrl?.trim();
  if (!base) {
    return logo;
  }
  if (/^https?:\/\//i.test(logo)) {
    return logo;
  }
  const origin = base.endsWith("/") ? base : `${base}/`;
  return new URL(logo, origin).href;
}

export function manifestToListItem(
  m: ServiceManifest,
  publicBaseUrl?: string,
): ServiceListItem {
  return {
    name: m.name,
    title: m.title,
    description: m.description,
    version: m.version,
    logo: resolvePublicLogo(m.logo, publicBaseUrl),
    metadata: m.metadata,
  };
}

export function manifestToDetail(
  m: ServiceManifest,
  publicBaseUrl?: string,
): ServiceDetailResponse {
  return {
    name: m.name,
    title: m.title,
    description: m.description,
    version: m.version,
    logo: resolvePublicLogo(m.logo, publicBaseUrl),
    metadata: m.metadata,
  };
}
