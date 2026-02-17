import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  ui,
  useDeploymentConfig,
  orcid,
  firebase,
  github,
  google,
  okta,
} from '@curvenote/scms-core';
import { useFetcher } from 'react-router';

type SubmitButtonUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
};

type SubmitButtonProps = {
  user: SubmitButtonUser | null;
  variant: 'sidebar' | 'review';
  isSaving?: boolean;
  /** Required for review variant when logged in: draft object id to submit. */
  draftObjectId?: string | null;
  /** Review variant: when false, submit button is disabled (e.g. until validation passes). */
  canSubmit?: boolean;
  /** Review variant: when provided, submit is blocked when this returns false (safety net). */
  validate?: () => boolean;
  /** Review variant: when user is pending, terms must be accepted; pass true to include in submit. */
  agreedToTerms?: boolean;
};

export function SubmitButton({
  user,
  variant,
  isSaving = false,
  draftObjectId = null,
  canSubmit = true,
  validate,
  agreedToTerms,
}: SubmitButtonProps) {
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const orcidFetcher = useFetcher();
  const submitFetcher = useFetcher();
  const config = useDeploymentConfig();

  const authProviders = config.authProviders?.filter((p) => p.allowLogin) ?? [];
  const hasOrcid = authProviders.some((p) => p.provider === 'orcid');
  const hasFirebase = authProviders.some((p) => p.provider === 'firebase');
  const hasGithub = authProviders.some((p) => p.provider === 'github');
  const hasGoogle = authProviders.some((p) => p.provider === 'google');
  const hasOkta = authProviders.some((p) => p.provider === 'okta');

  const currentUrl =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  useEffect(() => {
    if (orcidFetcher.state !== 'idle') {
      setSubmitting(true);
    } else {
      setSubmitting(false);
    }
  }, [orcidFetcher.state]);

  // Sidebar: logged in -> sync status (loading / Form saved)
  if (variant === 'sidebar' && user) {
    return (
      <div className="flex flex-col gap-2 justify-center items-center px-3 py-3 w-full text-sm text-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
        {isSaving ? (
          <span className="flex gap-2 items-center">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
            Saving…
          </span>
        ) : (
          <span className="text-muted-foreground">Form saved</span>
        )}
      </div>
    );
  }

  // Sidebar: not logged in -> sign in to save progress (whole box clickable, "Sign in" blue)
  if (variant === 'sidebar' && !user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInModalOpen(true)}
          className="flex flex-col gap-2 justify-center items-center px-3 py-3 w-full text-sm text-center rounded-lg border transition-colors cursor-pointer border-border bg-muted/50 text-muted-foreground hover:bg-muted"
        >
          <span>
            <span className="font-medium text-blue-600 dark:text-blue-400">Sign in</span>
            {' to save your progress and continue later'}
          </span>
        </button>
        <SignInDialog
          open={signInModalOpen}
          onOpenChange={setSignInModalOpen}
          title="Sign in"
          description="Sign in to save your progress and continue later. Choose an option below."
          currentUrl={currentUrl}
          orcidFetcher={orcidFetcher}
          submitting={submitting}
          hasOrcid={hasOrcid}
          hasFirebase={hasFirebase}
          hasGithub={hasGithub}
          hasGoogle={hasGoogle}
          hasOkta={hasOkta}
          setSubmitting={setSubmitting}
        />
      </>
    );
  }

  // Review: logged in -> Submit via fetcher so we stay on page and can show error
  if (variant === 'review' && user) {
    const submitError =
      submitFetcher.state === 'idle' &&
      submitFetcher.data &&
      typeof submitFetcher.data === 'object' &&
      'error' in submitFetcher.data
        ? (submitFetcher.data as { error?: { message?: string } }).error?.message
        : null;
    return (
      <div className="space-y-2">
        {submitError && (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        )}
        <submitFetcher.Form
          method="post"
          className="inline-block"
          onSubmit={(e) => {
            if (validate && !validate()) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="submit" />
          {draftObjectId && <input type="hidden" name="objectId" value={draftObjectId} />}
          {agreedToTerms && <input type="hidden" name="agreedToTerms" value="true" />}
          <button
            type="submit"
            disabled={!draftObjectId || submitFetcher.state !== 'idle' || !canSubmit}
            className="inline-flex gap-2 items-center justify-center min-w-[7rem] px-5 py-2 text-sm font-medium text-white rounded-md bg-[#3E7AA9] hover:bg-[#3E7AA9]/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {submitFetcher.state !== 'idle' ? 'Submitting…' : 'Submit'}
          </button>
        </submitFetcher.Form>
      </div>
    );
  }

  // Review: not logged in -> Sign in to submit (button-style, "Sign in" blue, same row as Back)
  return (
    <>
      <button
        type="button"
        onClick={() => setSignInModalOpen(true)}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer border-border bg-muted/50 text-muted-foreground hover:bg-muted"
      >
        <span>
          <span className="text-blue-600 dark:text-blue-400">Sign in</span>
          {' to submit'}
        </span>
      </button>
      <SignInDialog
        open={signInModalOpen}
        onOpenChange={setSignInModalOpen}
        title="Sign in"
        description="Sign in to submit your work. Choose an option below."
        currentUrl={currentUrl}
        orcidFetcher={orcidFetcher}
        submitting={submitting}
        hasOrcid={hasOrcid}
        hasFirebase={hasFirebase}
        hasGithub={hasGithub}
        hasGoogle={hasGoogle}
        hasOkta={hasOkta}
        setSubmitting={setSubmitting}
      />
    </>
  );
}

type SignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  currentUrl: string;
  orcidFetcher: ReturnType<typeof useFetcher>;
  submitting: boolean;
  hasOrcid: boolean;
  hasFirebase: boolean;
  hasGithub: boolean;
  hasGoogle: boolean;
  hasOkta: boolean;
  setSubmitting: (v: boolean) => void;
};

function SignInDialog({
  open,
  onOpenChange,
  title,
  description,
  currentUrl,
  orcidFetcher,
  submitting,
  hasOrcid,
  hasFirebase,
  hasGithub,
  hasGoogle,
  hasOkta,
  setSubmitting,
}: SignInDialogProps) {
  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent>
        <ui.DialogHeader>
          <ui.DialogTitle>{title}</ui.DialogTitle>
          <ui.DialogDescription>{description}</ui.DialogDescription>
        </ui.DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {hasOrcid && (
            <orcidFetcher.Form
              method="post"
              action={`/auth/orcid${currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''}`}
              className="w-full"
            >
              <ui.StatefulButton
                variant="outline"
                type="submit"
                disabled={submitting}
                busy={orcidFetcher.state !== 'idle'}
                overlayBusy
                className="w-full h-10"
              >
                <orcid.Badge size={18} />
              </ui.StatefulButton>
            </orcidFetcher.Form>
          )}
          {hasGithub && (
            <github.LoginUI
              disabled={submitting}
              setSubmitting={setSubmitting}
              className="w-full h-10"
            />
          )}
          {hasFirebase && (
            <firebase.FirebaseGoogleLoginUI
              disabled={submitting}
              setSubmitting={setSubmitting}
              className="w-full h-10"
              returnTo={currentUrl}
            />
          )}
          {hasGoogle && !hasFirebase && (
            <google.LoginUI
              disabled={submitting}
              setSubmitting={setSubmitting}
              className="w-full h-10"
              returnTo={currentUrl}
            />
          )}
          {hasOkta && (
            <okta.LoginUI
              disabled={submitting}
              setSubmitting={setSubmitting}
              className="w-full h-10"
              returnTo={currentUrl}
            />
          )}
        </div>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
