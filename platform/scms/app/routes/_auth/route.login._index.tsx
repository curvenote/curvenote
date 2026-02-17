import {
  useDeploymentConfig,
  firebase,
  github,
  google,
  okta,
  orcid,
  ui,
} from '@curvenote/scms-core';
import { useEffect, useState } from 'react';
import { OrDivider } from './OrDivider';
import type { ClientSideSafeAuthOptions, ClientSigninSignupConfig } from '@curvenote/scms-core';
import { getProviderUI } from './utils';
import { useSearchParams } from 'react-router';

/**
 * Hook to handle authentication error toasts from URL parameters.
 * Automatically shows error toasts when error parameters are present in the URL
 * and clears them from the URL after displaying.
 */
export function useAuthErrorToast() {
  const [params, setSearchParams] = useSearchParams();

  useEffect(() => {
    const err = params.get('error');
    const provider = params.get('provider');
    const status = params.get('status');
    const message = params.get('message');

    if (err) {
      const errorMessage = `Could not sign in${provider ? ` using ${provider}` : ''}`;
      const errorDescription =
        status || message ? `${status ? `[${status}] ` : ''}${message || ''}` : undefined;

      ui.toastError(errorMessage, {
        description: errorDescription,
      });

      // Clear error parameters from URL
      setSearchParams({}, { replace: true });
    }
  }, [params, setSearchParams]);
}

function AllProviderLoginArea({
  config,
  authProviders,
}: {
  config: ClientSigninSignupConfig;
  authProviders: ClientSideSafeAuthOptions[];
}) {
  useAuthErrorToast();

  // there is a more remix way to do this with useFetchers
  // but firebase spoils it
  const [submitting, setSubmitting] = useState(false);

  const loginAuthProviders = authProviders.filter((p) => p.allowLogin);
  const showOrDivider =
    loginAuthProviders.length > 0 &&
    loginAuthProviders.map(({ provider }) => provider).includes('firebase');
  const firebaseProvider = loginAuthProviders.find((p) => p.provider === 'firebase');
  const githubProvider = loginAuthProviders.find((p) => p.provider === 'github');
  const orcidProvider = loginAuthProviders.find((p) => p.provider === 'orcid');
  const googleProvider = loginAuthProviders.find((p) => p.provider === 'google');
  const oktaProvider = loginAuthProviders.find((p) => p.provider === 'okta');

  return (
    <div className="flex flex-col items-center space-y-8 w-full">
      <h1 className="mt-0 text-lg font-light text-center lg:text-xl">
        {config?.signin?.prompt ?? 'Sign in'}
      </h1>
      <div className="flex flex-wrap gap-x-1 gap-y-2 justify-center max-w-xs">
        {firebaseProvider && firebaseProvider.allowLogin && (
          <firebase.FirebaseGoogleLoginUI
            disabled={submitting}
            setSubmitting={setSubmitting}
            className="w-full"
          />
        )}
        {googleProvider && googleProvider.allowLogin && (
          <google.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
        )}
        {githubProvider && githubProvider.allowLogin && (
          <github.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
        )}
        {oktaProvider && oktaProvider.allowLogin && (
          <okta.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
        )}
        {orcidProvider && orcidProvider.allowLogin && (
          <orcid.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
        )}
      </div>
      {showOrDivider && <OrDivider />}
      {firebaseProvider && firebaseProvider.allowLogin && (
        <firebase.FirebasePasswordLoginUI disabled={submitting} setSubmitting={setSubmitting} />
      )}
    </div>
  );
}

function PreferredLoginArea({
  config,
  authProviders,
}: {
  config: ClientSigninSignupConfig;
  authProviders: ClientSideSafeAuthOptions[];
}) {
  useAuthErrorToast();
  const [submitting, setSubmitting] = useState(false);

  const preferredProvider = config.signin?.preferred;
  const providersThatAllowLogin = authProviders.filter((p) => p.allowLogin);
  if (
    !preferredProvider ||
    !providersThatAllowLogin.find((p) => p.provider === preferredProvider)
  ) {
    return (
      <div className="w-xs">
        <h2>Configuration Error: Preferred provider not found</h2>
        <p>
          Please contact{' '}
          <a
            href="mailto:support@curvenote.com"
            className="text-blue-600 underline hover:text-blue-800"
          >
            support@curvenote.com
          </a>
        </p>
      </div>
    );
  }

  const PreferredProviderUI = getProviderUI({
    provider: preferredProvider,
    submitting,
    setSubmitting,
  });

  const MoreProvidersUI = providersThatAllowLogin
    .filter((p) => p.provider !== preferredProvider)
    .map((p) => (
      <div key={p.provider}>
        {getProviderUI({
          provider: p.provider,
          submitting,
          setSubmitting,
        })}
      </div>
    ));

  const loginAuthProviders = authProviders.filter((p) => p.allowLogin);
  const firebaseProvider = loginAuthProviders.find((p) => p.provider === 'firebase');

  return (
    <div className="flex flex-col space-y-8 w-full items-left">
      <div className="space-y-4">
        <div className="text-lg lg:text-xl">
          {config?.signin?.prompt ?? 'Sign up or Sign in using the options below'}
        </div>
        <div className="space-y-2">
          {PreferredProviderUI}
          {MoreProvidersUI}
        </div>
      </div>
      {firebaseProvider && firebaseProvider.allowLogin && (
        <div className="space-y-4">
          <OrDivider />
          <firebase.FirebasePasswordLoginUI
            disabled={submitting}
            setSubmitting={setSubmitting}
            notice={
              <div>
                If you signed up with email and password at{' '}
                <a href="https://editor.curvenote.com" target="_blank" rel="noreferrer noopener">
                  editor.curvenote.com
                </a>{' '}
                you can use those credentials to log in here.
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

export default function LoginArea() {
  const { signupConfig, authProviders } = useDeploymentConfig();
  const { mode } = signupConfig?.signin ?? {};

  if (!signupConfig || !signupConfig.signup) {
    return (
      <div className="mx-auto my-32 lg:my-64">
        <h1>Signup is currently disabled.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === 'preferred' && (
        <PreferredLoginArea config={signupConfig} authProviders={authProviders} />
      )}
      {mode === 'all' && (
        <AllProviderLoginArea config={signupConfig} authProviders={authProviders} />
      )}
    </div>
  );
}
