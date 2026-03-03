import { useDeploymentConfig, LoginProviderButtons, firebase, ui } from '@curvenote/scms-core';
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

const LOGIN_PASSWORD_NOTICE = (
  <div>
    If you signed up with email and password at{' '}
    <a href="https://editor.curvenote.com" target="_blank" rel="noreferrer noopener">
      editor.curvenote.com
    </a>{' '}
    you can use those credentials to sign in here.
  </div>
);

function LoginWithPasswordSection({
  disabled,
  setSubmitting,
}: {
  disabled: boolean;
  setSubmitting: (value: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <OrDivider />
      <firebase.FirebasePasswordLoginUI
        disabled={disabled}
        setSubmitting={setSubmitting}
        notice={LOGIN_PASSWORD_NOTICE}
      />
    </div>
  );
}

function AllProviderLoginArea({
  config,
  authProviders,
}: {
  config: ClientSigninSignupConfig;
  authProviders: ClientSideSafeAuthOptions[];
}) {
  useAuthErrorToast();

  const [submitting, setSubmitting] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  const loginAuthProviders = authProviders.filter((p) => p.allowLogin);
  const firebaseProvider = loginAuthProviders.find((p) => p.provider === 'firebase');
  const hasPasswordLogin = firebaseProvider?.allowLogin === true;

  return (
    <div className="flex flex-col items-center space-y-8 w-full">
      <h1 className="mt-0 text-lg font-light text-center lg:text-xl">
        {config?.signin?.prompt ?? 'Sign in or sign up'}
      </h1>
      <div className="w-full max-w-xs">
        <LoginProviderButtons
          authProviders={authProviders}
          submitting={submitting}
          setSubmitting={setSubmitting}
          className="w-full"
        />
      </div>
      {hasPasswordLogin && (
        <div className="space-y-2 w-full max-w-xs">
          {!showPasswordLogin ? (
            <div className="text-sm text-center">
              <ui.Button
                type="button"
                variant="link"
                onClick={() => setShowPasswordLogin(true)}
                className="text-sm lg:text-md"
              >
                {config?.signin?.alternativePrompt ?? 'Sign in with email and password'}
              </ui.Button>
            </div>
          ) : (
            <LoginWithPasswordSection disabled={submitting} setSubmitting={setSubmitting} />
          )}
        </div>
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
  const [showMoreProviders, setShowMoreProviders] = useState(false);
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

  const firebaseProvider = providersThatAllowLogin.find((p) => p.provider === 'firebase');

  return (
    <div className="flex flex-col space-y-8 w-full items-left">
      <div className="space-y-4">
        <div className="text-lg lg:text-xl">{config?.signin?.prompt ?? 'Sign in'}</div>
        <div>{PreferredProviderUI}</div>
      </div>
      <div className="space-y-2">
        <div className="">
          <ui.Button
            type="button"
            variant="link"
            size="lg"
            onClick={() => setShowMoreProviders(true)}
            className="text-md lg:text-md"
          >
            {config?.signin?.alternativePrompt ?? 'More sign in options'}
          </ui.Button>
        </div>
        {showMoreProviders && (
          <div className="space-y-8">
            <div className="space-y-2">{MoreProvidersUI}</div>
            {firebaseProvider && firebaseProvider.allowLogin && (
              <LoginWithPasswordSection disabled={submitting} setSubmitting={setSubmitting} />
            )}
          </div>
        )}
      </div>
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
