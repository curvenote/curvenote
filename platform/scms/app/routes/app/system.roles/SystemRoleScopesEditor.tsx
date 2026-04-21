import { useMemo, useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui, scopes as scopeTree } from '@curvenote/scms-core';
import { Check } from 'lucide-react';
import type { GeneralError } from '@curvenote/scms-core';
import { flattenScopeTree, flattenWorkRootScopesForSystemRoles } from './flattenScopeTree';

type EditableSystemRole = {
  role: string;
  scopes: string[];
  fallback_scopes: string[];
  date_created: string | null;
  date_modified: string | null;
};

const PRIVILEGED_SCOPES = ['system:admin', 'app:platform:admin'] as const;

function formatDate(value: string | null): string {
  if (!value) return 'Not configured yet';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseScopeList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeScopeList(value: string): string[] {
  return Array.from(new Set(parseScopeList(value))).sort();
}

interface EditorRowProps {
  role: EditableSystemRole;
  availableScopes: string[];
  extensionScopes: string[];
}

function SystemRoleRow({ role, availableScopes, extensionScopes }: EditorRowProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: GeneralError | string }>();
  const hasDbEntry = role.date_created !== null;
  const initialScopes = useMemo(
    () => (hasDbEntry ? role.scopes.join(', ') : ''),
    [hasDbEntry, role.scopes],
  );
  const [scopesText, setScopesText] = useState(initialScopes);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'update' | 'delete' | null>(null);
  const isSubmitting = fetcher.state === 'submitting';
  const fallbackScopesSet = useMemo(() => new Set(role.fallback_scopes), [role.fallback_scopes]);
  const extensionScopesSet = useMemo(() => new Set(extensionScopes), [extensionScopes]);
  const normalizedInitialScopes = useMemo(() => normalizeScopeList(initialScopes), [initialScopes]);
  const normalizedCurrentScopes = useMemo(() => normalizeScopeList(scopesText), [scopesText]);
  const initialScopesSet = useMemo(
    () => new Set(normalizedInitialScopes),
    [normalizedInitialScopes],
  );
  const currentScopesSet = useMemo(
    () => new Set(normalizedCurrentScopes),
    [normalizedCurrentScopes],
  );
  const newlyAddedPrivilegedScopes = useMemo(
    () =>
      PRIVILEGED_SCOPES.filter(
        (scope) => currentScopesSet.has(scope) && !initialScopesSet.has(scope),
      ),
    [currentScopesSet, initialScopesSet],
  );
  const hasScopeChanges = useMemo(
    () => normalizedInitialScopes.join('\n') !== normalizedCurrentScopes.join('\n'),
    [normalizedInitialScopes, normalizedCurrentScopes],
  );
  const selectedScopes = useMemo(() => parseScopeList(scopesText), [scopesText]);
  const selectedScopesSet = useMemo(() => new Set(selectedScopes), [selectedScopes]);
  const knownScopesSet = useMemo(() => new Set(availableScopes), [availableScopes]);
  const additionalScopes = useMemo(
    () => Array.from(new Set(selectedScopes.filter((scope) => !knownScopesSet.has(scope)))),
    [selectedScopes, knownScopesSet],
  );

  useEffect(() => {
    setScopesText(initialScopes);
  }, [initialScopes]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      if (!pendingAction) return;
      if (pendingAction === 'delete') {
        ui.toastSuccess(`${role.role} database config deleted`);
      } else {
        ui.toastSuccess(`${role.role} scopes updated`);
      }
      setShowConfirm(false);
      setShowDeleteConfirm(false);
      setPendingAction(null);
    } else if (fetcher.state === 'idle' && fetcher.data?.error) {
      if (!pendingAction) return;
      const errorMessage =
        typeof fetcher.data.error === 'string'
          ? fetcher.data.error
          : fetcher.data.error.message || 'An unknown error occurred';
      ui.toastError(errorMessage);
      setPendingAction(null);
    }
  }, [fetcher.state, fetcher.data, role.role, pendingAction]);

  const submitUpdate = () => {
    setPendingAction('update');
    const formData = new FormData();
    formData.append('intent', 'system-role-update');
    formData.append('role', role.role);
    formData.append('scopes', scopesText);
    fetcher.submit(formData, { method: 'POST' });
  };

  const handleSubmitUpdate = () => {
    if (newlyAddedPrivilegedScopes.length > 0) {
      setShowConfirm(true);
      return;
    }
    submitUpdate();
  };

  const submitDelete = () => {
    setPendingAction('delete');
    const formData = new FormData();
    formData.append('intent', 'system-role-delete');
    formData.append('role', role.role);
    fetcher.submit(formData, { method: 'POST' });
  };

  return (
    <div className="p-4 space-y-3 rounded-md border">
      <div className="flex gap-4 justify-between items-center">
        <div>
          <h3 className="font-semibold">{role.role}</h3>
          <p className="text-sm text-muted-foreground">
            Last updated {formatDate(role.date_modified)}
          </p>
        </div>
      </div>

      {!hasDbEntry && (
        <div className="px-3 py-2 text-sm text-amber-900 bg-amber-50 rounded-md border border-amber-300 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          No database configuration exists for <strong>{role.role}</strong> yet; the{' '}
          <span className="font-bold text-blue-700 dark:text-blue-300">blue</span> scopes in{' '}
          <strong>Known scopes</strong> are the in-code fallback scopes that are currently applied.
        </div>
      )}

      <div>
        <ui.Label htmlFor={`system-role-scopes-${role.role}`}>Scopes</ui.Label>
        <ui.Textarea
          id={`system-role-scopes-${role.role}`}
          value={scopesText}
          onChange={(event) => setScopesText(event.target.value)}
          disabled={isSubmitting}
          rows={4}
          className="mt-1"
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Known scopes</p>
        <div className="overflow-y-auto p-2 max-h-44 rounded border">
          <div className="flex flex-wrap gap-1">
            {availableScopes.map((scope) => {
              const isSelected = selectedScopesSet.has(scope);
              const isFallbackScope = fallbackScopesSet.has(scope);
              const isExtensionScope = extensionScopesSet.has(scope);
              const isPrivilegedScope = PRIVILEGED_SCOPES.includes(
                scope as (typeof PRIVILEGED_SCOPES)[number],
              );
              return (
                <button
                  key={scope}
                  type="button"
                  className={
                    isSelected
                      ? isFallbackScope
                        ? 'px-2 py-1 text-xs text-blue-900 bg-blue-100 rounded border border-blue-500 cursor-pointer hover:bg-blue-200 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-100'
                        : isPrivilegedScope
                          ? 'px-2 py-1 text-xs text-red-900 bg-red-100 rounded border border-red-500 cursor-pointer hover:bg-red-200 dark:border-red-500 dark:bg-red-900/40 dark:text-red-100'
                          : isExtensionScope
                            ? 'px-2 py-1 text-xs text-amber-900 bg-amber-100 rounded border border-amber-500 cursor-pointer hover:bg-amber-200 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-100'
                            : 'px-2 py-1 text-xs text-gray-900 bg-gray-200 rounded border border-gray-500 cursor-pointer hover:bg-gray-300 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100'
                      : isFallbackScope
                        ? 'px-2 py-1 text-xs text-blue-900 bg-blue-100 rounded border border-blue-500 cursor-pointer hover:bg-blue-200 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-100'
                        : isPrivilegedScope
                          ? 'px-2 py-1 text-xs text-red-900 bg-red-100 rounded border border-red-400 cursor-pointer hover:bg-red-200 dark:border-red-500 dark:bg-red-900/30 dark:text-red-100'
                          : isExtensionScope
                            ? 'px-2 py-1 text-xs text-amber-900 bg-amber-100 rounded border border-amber-400 cursor-pointer hover:bg-amber-200 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-100'
                            : 'px-2 py-1 text-xs text-gray-800 bg-gray-100 rounded border border-gray-400 cursor-pointer hover:bg-gray-200 dark:border-gray-500 dark:bg-gray-900/80 dark:text-gray-100'
                  }
                  onClick={() => {
                    setScopesText((prev) => {
                      const currentScopes = parseScopeList(prev);
                      const hasScope = currentScopes.includes(scope);
                      const nextScopes = hasScope
                        ? currentScopes.filter((item) => item !== scope)
                        : [...currentScopes, scope];
                      return nextScopes.join(', ');
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <span className="inline-flex gap-1 items-center">
                    {scope}
                    {isSelected && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {additionalScopes.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Additional scopes</p>
          <div className="p-2 rounded border">
            <div className="flex flex-wrap gap-1">
              {additionalScopes.map((scope) => (
                <span
                  key={scope}
                  className="px-2 py-1 text-xs text-amber-900 bg-amber-50 rounded border border-amber-300 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <div className="flex gap-2">
          <ui.Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSubmitting || !hasDbEntry}
          >
            Delete
          </ui.Button>
          <ui.Button
            variant="outline"
            onClick={() => setScopesText(initialScopes)}
            disabled={isSubmitting || scopesText === initialScopes}
          >
            Reset
          </ui.Button>
          <ui.StatefulButton
            onClick={handleSubmitUpdate}
            busy={isSubmitting}
            overlayBusy
            disabled={isSubmitting || !hasScopeChanges}
          >
            {hasDbEntry ? 'Update' : 'Create'} {role.role}
          </ui.StatefulButton>
        </div>
      </div>

      <ui.Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>Confirm privileged scope grant</ui.DialogTitle>
            <ui.DialogDescription>
              You are adding privileged scope{newlyAddedPrivilegedScopes.length > 1 ? 's' : ''}{' '}
              <strong>{newlyAddedPrivilegedScopes.join(', ')}</strong> to {role.role}. Continue?
            </ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </ui.Button>
            <ui.Button onClick={submitUpdate} disabled={isSubmitting}>
              Confirm {hasDbEntry ? 'update' : 'create'}
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>

      <ui.Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>Delete system role configuration</ui.DialogTitle>
            <ui.DialogDescription>
              This removes the saved DB configuration for {role.role}. The role will fall back to
              default in-code scopes until saved again.
            </ui.DialogDescription>
          </ui.DialogHeader>
          <ui.DialogFooter>
            <ui.Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </ui.Button>
            <ui.Button variant="destructive" onClick={submitDelete} disabled={isSubmitting}>
              Confirm delete
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    </div>
  );
}

interface SystemRoleScopesEditorProps {
  roles: EditableSystemRole[];
  extensionScopes: string[];
}

export function SystemRoleScopesEditor({ roles, extensionScopes }: SystemRoleScopesEditorProps) {
  const roleOrder = useMemo(() => ['ANON', 'USER', 'ADMIN', 'SERVICE'], []);
  const orderedRoles = useMemo(() => {
    const rank = new Map<string, number>(roleOrder.map((role, index) => [role, index]));
    return [...roles].sort((a, b) => {
      const rankA = rank.get(a.role) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rank.get(b.role) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.role.localeCompare(b.role);
    });
  }, [roles, roleOrder]);

  const availableScopes = useMemo(() => {
    const knownRootWorkScopes = new Set(flattenWorkRootScopesForSystemRoles());
    return Array.from(
      new Set([
        ...flattenScopeTree(scopeTree).filter((scope) => {
          if (scope.startsWith('site:')) return false;
          if (scope.startsWith('work:')) return knownRootWorkScopes.has(scope);
          return true;
        }),
        ...extensionScopes,
      ]),
    ).sort();
  }, [extensionScopes]);
  return (
    <div className="space-y-4">
      {orderedRoles.map((role) => (
        <SystemRoleRow
          key={role.role}
          role={role}
          availableScopes={availableScopes}
          extensionScopes={extensionScopes}
        />
      ))}
    </div>
  );
}
