import type { ClientExtension } from '@curvenote/scms-core';

let appExtensions: ClientExtension[] = [];

/**
 * Registers the platform extension list once at app bootstrap (see platform/scms/app/root.tsx).
 * Enables server code outside platform routes (e.g. ee/sites loaders) to resolve extension workflows.
 */
export function setAppExtensions(extensions: ClientExtension[]): void {
  appExtensions = extensions;
}

export function getAppExtensions(): ClientExtension[] {
  return appExtensions;
}
