import { relayConfig } from './relay-config.js';

type NotifyUrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

function normalizeAllowlistPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function pathMatchesPrefix(candidatePath: string, allowPath: string): boolean {
  if (allowPath === '/') return true;
  return candidatePath === allowPath || candidatePath.startsWith(`${allowPath}/`);
}

function parseAllowedBaseUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isAllowedNotifyUrl(parsed: URL, allowlist: string[]): boolean {
  for (const item of allowlist) {
    const allowed = parseAllowedBaseUrl(item);
    if (!allowed) continue;
    if (allowed.protocol !== parsed.protocol) continue;
    if (allowed.hostname !== parsed.hostname) continue;
    if (allowed.port !== parsed.port) continue;
    if (
      !pathMatchesPrefix(
        normalizeAllowlistPath(parsed.pathname),
        normalizeAllowlistPath(allowed.pathname),
      )
    ) {
      continue;
    }
    return true;
  }
  return false;
}

export function validateNotifyUrl(notifyUrl: string): NotifyUrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(notifyUrl);
  } catch {
    return { ok: false, reason: 'notify_url must be a valid absolute URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'notify_url must use http or https' };
  }

  const allowlist = relayConfig().notifyUrlAllowlist;
  if (allowlist && allowlist.length > 0 && !isAllowedNotifyUrl(parsed, allowlist)) {
    return { ok: false, reason: 'notify_url is not in the configured allowlist' };
  }

  return { ok: true, url: parsed };
}
