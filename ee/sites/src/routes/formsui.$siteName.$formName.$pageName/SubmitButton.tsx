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
};

export function SubmitButton({ user }: SubmitButtonProps) {
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

  if (user) {
    return (
      <ui.Button
        className="w-full bg-[#3E7AA9] text-white hover:bg-[#3E7AA9]/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        size="lg"
      >
        Review & Submit
      </ui.Button>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 justify-center items-center px-4 py-6 w-full text-sm text-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
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
      <ui.Dialog open={signInModalOpen} onOpenChange={setSignInModalOpen}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>Sign in</ui.DialogTitle>
            <ui.DialogDescription>
              Sign in to submit your work. Choose an option below.
            </ui.DialogDescription>
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
    </>
  );
}
