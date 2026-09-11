import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlockerFunction } from 'react-router';
import { useBlocker } from 'react-router';
import { ui } from '@curvenote/scms-core';

/** Tooltip styling for messages that explain why something cannot be saved. */
export const ERROR_TOOLTIP_CLASS = 'max-w-xs text-left text-red-600';

/** Minimal shape of the fetcher used to run the save, so any `useFetcher()` fits. */
interface GuardFetcher {
  state: 'idle' | 'loading' | 'submitting';
  data: unknown;
}

interface UnsavedChangesGuardProps {
  /** Whether the page has changes that have not been saved yet. */
  dirty: boolean;
  /** Fetcher that `onSave` submits with; watched to know when the save settles. */
  fetcher: GuardFetcher;
  onSave: () => void;
  onDiscard: () => void;
  /** Called when the save fails, e.g. to restore a dirty flag cleared by `onSave`. */
  onSaveError?: (error: string) => void;
  /** Set false when the user cannot save, e.g. lacking scopes; they can still discard. */
  canSave?: boolean;
  /** Why saving is unavailable, shown in the dialog when `canSave` is false. */
  saveError?: string;
  /** Dialog copy, to name what is unsaved; defaults to generic wording. */
  description?: ReactNode;
}

/**
 * Guards a page with unsaved changes. Blocks in-app navigation away from the page
 * while `dirty` and offers to save, discard, or stay; reloads and closing the tab
 * fall back to the browser's own prompt.
 *
 * Drop it anywhere in the page — it renders nothing until a navigation is blocked.
 *
 * @example
 * <UnsavedChangesGuard
 *   dirty={dirty}
 *   fetcher={fetcher}
 *   canSave={canEdit}
 *   description="You have unsaved changes to this site's design. Save them before leaving?"
 *   onSave={handleSave}
 *   onDiscard={resetFromLoaderData}
 *   onSaveError={() => setDirty(true)}
 * />
 */
export function UnsavedChangesGuard({
  canSave = true,
  saveError,
  description = 'You have unsaved changes. Would you like to save them before leaving this page?',
  ...options
}: UnsavedChangesGuardProps) {
  const { blocked, saving, error, save, discard, cancel } = useUnsavedChangesGuard(options);

  return (
    <ui.SimpleDialog
      open={blocked}
      onOpenChange={(next) => {
        if (!next) cancel();
      }}
      title="Unsaved changes"
      description={description}
      footer={
        <>
          <ui.Button variant="ghost" onClick={cancel} disabled={saving}>
            Keep editing
          </ui.Button>
          <ui.Button variant="outline" onClick={discard} disabled={saving}>
            Discard changes
          </ui.Button>
          {saveError ? (
            <ui.SimpleTooltip title={saveError} className={ERROR_TOOLTIP_CLASS}>
              {/* A disabled button fires no pointer events, so the span carries the tooltip */}
              <span className="inline-flex">
                <ui.Button disabled>Save changes</ui.Button>
              </span>
            </ui.SimpleTooltip>
          ) : (
            <ui.Button onClick={save} disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </ui.Button>
          )}
        </>
      }
    >
      {error && <ui.ErrorMessage error={error} />}
    </ui.SimpleDialog>
  );
}

export interface UnsavedChanges {
  /** A navigation is blocked and waiting on the user — show the dialog. */
  blocked: boolean;
  /** The save started from the dialog is still in flight. */
  saving: boolean;
  /** Error from the last save started from the dialog, if it failed. */
  error?: string;
  /** Save, then continue to the blocked destination once the save succeeds. */
  save: () => void;
  /** Throw the changes away and continue to the blocked destination. */
  discard: () => void;
  /** Stay on the page and keep the changes. */
  cancel: () => void;
}

/**
 * The navigation blocking behind {@link UnsavedChangesGuard}, for pages that need
 * their own dialog instead of the standard one.
 */
export function useUnsavedChangesGuard({
  dirty,
  fetcher,
  onSave,
  onDiscard,
  onSaveError,
}: Omit<UnsavedChangesGuardProps, 'canSave' | 'saveError' | 'description'>): UnsavedChanges {
  const [pendingSave, setPendingSave] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const previousFetcherState = useRef(fetcher.state);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
    [dirty],
  );
  const blocker = useBlocker(shouldBlock);

  // The browser's own prompt covers reloads and closing the tab
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Continue the blocked navigation once the save started from the dialog settles
  useEffect(() => {
    const settled = previousFetcherState.current !== 'idle' && fetcher.state === 'idle';
    previousFetcherState.current = fetcher.state;
    if (!pendingSave || !settled) return;

    setPendingSave(false);
    const saveError = (fetcher.data as { error?: string } | undefined)?.error;
    if (saveError) {
      // Keep the dialog open with the changes intact so they are not lost
      setError(saveError);
      onSaveError?.(saveError);
      return;
    }
    blocker.proceed?.();
  }, [fetcher.state, fetcher.data, pendingSave, blocker, onSaveError]);

  return {
    blocked: blocker.state === 'blocked',
    saving: pendingSave,
    error,
    save: () => {
      setError(undefined);
      setPendingSave(true);
      onSave();
    },
    discard: () => {
      onDiscard();
      blocker.proceed?.();
    },
    cancel: () => {
      setError(undefined);
      setPendingSave(false);
      blocker.reset?.();
    },
  };
}
