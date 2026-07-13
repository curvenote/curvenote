import type {
  ClientExtension,
  ExtensionCreateWorkVersionArgs,
  ExtensionCreateWorkVersionResult,
  IconComponent,
  ServerExtension,
  WorkCreateOption,
} from '../extensions/types.js';
import { getExtensionIcon } from '../extensions/icons.js';
import { scopes } from '../../scopes.js';
import {
  BUILTIN_ARTICLE_WORK_CREATE_OPTION,
  BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
} from './builtinArticleOption.js';
import {
  BUILTIN_CHECK_WORK_CREATE_OPTION,
  BUILTIN_CHECK_WORK_CREATE_OPTION_ID,
} from './builtinCheckWorkOption.js';
import { resolveWorkCreateOptionFromMetadata } from './resolveWorkCreateOption.js';

/** Loader-safe create-work option (no React component references). */
export type SerializableWorkCreateOption = Omit<WorkCreateOption, 'icon'>;

export function toSerializableWorkCreateOptions(
  options: WorkCreateOption[],
): SerializableWorkCreateOption[] {
  return options.map((option) => {
    const { icon, ...rest } = option;
    void icon;
    return rest;
  });
}

function iconForSerializableOption(
  option: SerializableWorkCreateOption,
  clientExtensions: ClientExtension[],
): IconComponent | undefined {
  if (option.id === BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID) {
    return BUILTIN_ARTICLE_WORK_CREATE_OPTION.icon;
  }
  if (option.id === BUILTIN_CHECK_WORK_CREATE_OPTION_ID) {
    return BUILTIN_CHECK_WORK_CREATE_OPTION.icon;
  }
  if (!option.extensionId) return undefined;

  const ext = clientExtensions.find((e) => e.id === option.extensionId);
  const registered = ext?.getWorkCreateOptions?.().find((o) => o.id === option.id);
  if (registered?.icon) return registered.icon;

  return getExtensionIcon(clientExtensions, option.extensionId);
}

/** Re-attach icons from the client extension registry after loader deserialization. */
export function hydrateWorkCreateOptions(
  options: SerializableWorkCreateOption[],
  clientExtensions: ClientExtension[],
): WorkCreateOption[] {
  return options.map((option) => {
    const icon = iconForSerializableOption(option, clientExtensions);
    return icon ? { ...option, icon } : option;
  });
}

function sortWorkCreateOptions(options: WorkCreateOption[]): WorkCreateOption[] {
  return [...options].sort((a, b) => {
    const aLast = a.sortLast === true ? 1 : 0;
    const bLast = b.sortLast === true ? 1 : 0;
    if (aLast !== bLast) return aLast - bLast;
    return (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label);
  });
}

function userHasAllScopes(userScopes: string[], requiredScopes: string[]): boolean {
  if (userScopes.includes(scopes.system.admin)) return true;
  if (requiredScopes.length === 0) return true;
  if (userScopes.length === 0) return false;
  return requiredScopes.every((scope) => userScopes.includes(scope));
}

function filterOptionByScopes(option: WorkCreateOption, userScopes: string[]): boolean {
  const required = option.scopes ?? [];
  return userHasAllScopes(userScopes, required);
}

/**
 * Returns extension create-work options filtered by extension config (`routes: true`) and scopes.
 */
export function getExtensionWorkCreateOptions(
  config: Record<string, { routes?: boolean }>,
  clientExtensions: ClientExtension[],
  userScopes: string[],
): WorkCreateOption[] {
  const options: WorkCreateOption[] = [];

  for (const ext of clientExtensions) {
    const extConfig = config[ext.id];
    if (extConfig?.routes !== true || !ext.getWorkCreateOptions) continue;

    for (const option of ext.getWorkCreateOptions()) {
      if (!filterOptionByScopes(option, userScopes)) continue;
      options.push({ ...option, extensionId: ext.id });
    }
  }

  return sortWorkCreateOptions(options);
}

/**
 * Built-in Article option plus extension options available to the current user.
 */
export function getAvailableWorkCreateOptions(
  config: Record<string, { routes?: boolean }>,
  clientExtensions: ClientExtension[],
  userScopes: string[],
  { includeArticle = true }: { includeArticle?: boolean } = {},
): WorkCreateOption[] {
  const extensionOptions = getExtensionWorkCreateOptions(config, clientExtensions, userScopes);
  const builtinOptions: WorkCreateOption[] = [];
  if (includeArticle) builtinOptions.push(BUILTIN_ARTICLE_WORK_CREATE_OPTION);
  if (filterOptionByScopes(BUILTIN_CHECK_WORK_CREATE_OPTION, userScopes)) {
    builtinOptions.push(BUILTIN_CHECK_WORK_CREATE_OPTION);
  }
  return sortWorkCreateOptions([...builtinOptions, ...extensionOptions]);
}

/**
 * All extension create-work options from registered extensions, without config or scope filtering.
 * Used to detect a work's intended flow when create-new-version may not expose that flow to the user.
 */
export function getAllRegisteredWorkCreateOptions(
  clientExtensions: ClientExtension[],
): WorkCreateOption[] {
  const options: WorkCreateOption[] = [];

  for (const ext of clientExtensions) {
    if (!ext.getWorkCreateOptions) continue;

    for (const option of ext.getWorkCreateOptions()) {
      options.push({ ...option, extensionId: ext.id });
    }
  }

  return sortWorkCreateOptions(options);
}

export type ResolveCreateNewVersionOptionResult =
  | { ok: true; option: WorkCreateOption }
  | { ok: false; error: string; status: 403 };

/**
 * Resolve which create flow to use for an existing work, failing clearly when metadata implies
 * an extension flow that is disabled or unavailable to the current user.
 */
export function resolveCreateNewVersionOption(
  sourceMetadata: Record<string, unknown>,
  config: Record<string, { routes?: boolean }>,
  extensions: ClientExtension[],
  userScopes: string[],
): ResolveCreateNewVersionOptionResult {
  const allRegisteredOptions = getAllRegisteredWorkCreateOptions(extensions);
  const intendedOption = resolveWorkCreateOptionFromMetadata(sourceMetadata, [
    BUILTIN_ARTICLE_WORK_CREATE_OPTION,
    ...allRegisteredOptions,
  ]);

  const availableOptions = getAvailableWorkCreateOptions(config, extensions, userScopes);

  if (intendedOption.extensionId) {
    const availableOption = availableOptions.find(
      (option) =>
        option.id === intendedOption.id && option.extensionId === intendedOption.extensionId,
    );
    if (!availableOption) {
      return {
        ok: false,
        error: `The "${intendedOption.label}" create flow is not available.`,
        status: 403,
      };
    }
    return { ok: true, option: availableOption };
  }

  return {
    ok: true,
    option: resolveWorkCreateOptionFromMetadata(sourceMetadata, availableOptions),
  };
}

export async function invokeExtensionCreateWorkVersion(
  serverExtensions: ServerExtension[],
  extensionId: string | undefined,
  args: ExtensionCreateWorkVersionArgs,
): Promise<ExtensionCreateWorkVersionResult | null> {
  if (!extensionId) return null;
  const ext = serverExtensions.find((e) => e.id === extensionId);
  if (!ext?.createWorkVersion) return null;
  return ext.createWorkVersion(args);
}
