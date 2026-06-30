import type {
  ClientExtension,
  ExtensionCreateWorkVersionArgs,
  ExtensionCreateWorkVersionResult,
  ServerExtension,
  WorkCreateOption,
} from '../extensions/types.js';
import { scopes } from '../../scopes.js';
import { BUILTIN_ARTICLE_WORK_CREATE_OPTION } from './builtinArticleOption.js';

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

  return options.sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label),
  );
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
  const articleOption = includeArticle ? [BUILTIN_ARTICLE_WORK_CREATE_OPTION] : [];
  return [...articleOption, ...extensionOptions];
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
