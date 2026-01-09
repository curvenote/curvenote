import { firebase, google, okta, orcid } from '@curvenote/scms-core';

export function getProviderUI({
  provider,
  submitting,
  setSubmitting,
}: {
  provider: string;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}) {
  switch (provider) {
    case 'google':
      return (
        <google.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
      );
    case 'okta':
      return (
        <okta.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
      );
    case 'orcid':
      return (
        <orcid.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
      );
    case 'firebase':
      return (
        <firebase.FirebaseGoogleLoginUI
          disabled={submitting}
          setSubmitting={setSubmitting}
          className="w-full"
        />
      );
  }
}
