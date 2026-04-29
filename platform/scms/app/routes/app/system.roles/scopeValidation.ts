import { isValidScopeFormat } from '@curvenote/scms-server';

export function parseScopes(scopesString: string | null | undefined): string[] {
  if (!scopesString) return [];
  return scopesString
    .split(/[,\n]/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getInvalidScopes(scopes: string[]): string[] {
  return scopes.filter((scope) => !isValidScopeFormat(scope));
}
