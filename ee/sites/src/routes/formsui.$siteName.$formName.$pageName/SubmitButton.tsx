import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ui, useDeploymentConfig, orcid, firebase, google, okta } from '@curvenote/scms-core';
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
};

export function SubmitButton({ user, variant, isSaving = false }: SubmitButtonProps) {
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const orcidFetcher = useFetcher();
  const config = useDeploymentConfig();

  const authProviders = config.authProviders?.filter((p) => p.allowLogin) ?? [];
  const hasOrcid = authProviders.some((p) => p.provider === 'orcid');
  const hasFirebase = authProviders.some((p) => p.provider === 'firebase');
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

  // Sidebar: not logged in -> sign in to save progress
  if (variant === 'sidebar' && !user) {
    return (
      <>
        <div className="flex flex-col gap-2 justify-center items-center px-3 py-3 w-full text-sm text-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
          <span>
            <button
              type="button"
              onClick={() => setSignInModalOpen(true)}
              className="font-medium text-blue-600 cursor-pointer dark:text-blue-400 underline-offset-4 hover:underline"
            >
              Sign in
            </button>
            {' to save your progress and continue later'}
          </span>
        </div>
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
          hasGoogle={hasGoogle}
          hasOkta={hasOkta}
          setSubmitting={setSubmitting}
        />
      </>
    );
  }

  // Review: logged in -> Submit button
  if (variant === 'review' && user) {
    return (
      <ui.Button
        className="w-full bg-[#3E7AA9] text-white hover:bg-[#3E7AA9]/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        size="lg"
        type="button"
      >
        Submit
      </ui.Button>
    );
  }

  // Review: not logged in -> Sign in to submit
  return (
    <>
      <div className="flex flex-col gap-2 justify-center items-center px-3 py-3 w-full text-sm text-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
        <span>
          <button
            type="button"
            onClick={() => setSignInModalOpen(true)}
            className="font-medium text-blue-600 cursor-pointer dark:text-blue-400 underline-offset-4 hover:underline"
          >
            Sign in
          </button>
          {' to submit'}
        </span>
      </div>
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
