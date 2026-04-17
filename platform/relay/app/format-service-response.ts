import type { ServiceManifest } from "@curvenote/check-plugin-types";
import type { ServiceListItem } from "@curvenote/check-relay-types";

/**
 * Turn a manifest `logo` into an absolute URL when `publicBaseUrl` is configured.
 * Already-absolute `http(s):` logos are unchanged. Root-relative paths (e.g. `/api/assets/...`)
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

/** Client-facing service record for list and detail endpoints (identical wire shape). */
export function manifestToClientService(
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
