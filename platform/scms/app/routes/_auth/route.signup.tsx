import type { Route } from './+types/route.signup';
import { redirect } from 'react-router';
import { useState } from 'react';
import { ui, useDeploymentConfig, firebase, google, okta, orcid } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';
import type { ClientSigninSignupConfig, ClientSideSafeAuthOptions } from '@curvenote/scms-core';
import { OrDivider } from './OrDivider';
import { getProviderUI } from './utils';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  if (ctx.user) {
    if (ctx.user.pending) {
      if (ctx.user.ready_for_approval) {
        throw redirect('/awaiting-approval');
      }
      throw redirect('/new-account/pending');
    }
    throw redirect('/app');
  }

  return null;
}

function PreferredSignupUI({
  config,
  authProviders,
}: {
  config: ClientSigninSignupConfig;
  authProviders: ClientSideSafeAuthOptions[];
}) {
  const [showMoreProviders, setShowMoreProviders] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preferredProvider = config.signup?.preferred;
  const providersThatAllowSignup = authProviders.filter((p) => p.provisionNewUser);
  const firebaseProvider = providersThatAllowSignup.find((p) => p.provider === 'firebase');
  const showOrDivider =
    providersThatAllowSignup.length > 0 &&
    providersThatAllowSignup.map(({ provider }) => provider).includes('firebase');

  if (
    !preferredProvider ||
    !providersThatAllowSignup.find((p) => p.provider === preferredProvider)
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

  const MoreProvidersUI = providersThatAllowSignup
    .filter((p) => p.provider !== preferredProvider)
    .map((p) =>
      getProviderUI({
        provider: p.provider,
        submitting,
        setSubmitting,
      }),
    );

  return (
    <div className="my-2 space-y-8">
      <div className="space-y-4">
        <div className="text-lg lg:text-xl">{config?.signup?.prompt}</div>
        <div>{PreferredProviderUI}</div>
      </div>
      <div className="space-y-2">
        <div className="text-sm">
          <ui.Button
            variant="link"
            onClick={() => setShowMoreProviders(true)}
            className="text-msmlg:text-md"
          >
            {config?.signup?.alternativePrompt}
          </ui.Button>
        </div>
        {showMoreProviders && (
          <div className="space-y-8">
            <div className="space-y-2">{MoreProvidersUI}</div>
            {showOrDivider && <OrDivider />}
            {firebaseProvider && firebaseProvider.allowLogin && (
              <firebase.FirebasePasswordLoginUI
                disabled={submitting}
                setSubmitting={setSubmitting}
                notice={
                  <div>
                    To sign up, with username and password, first make an account on{' '}
                    <a
                      href="https://editor.curvenote.com"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      https://editor.curvenote.com
                    </a>
                    .
                  </div>
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AllSignupUI({
  config,
  authProviders,
}: {
  config: ClientSigninSignupConfig;
  authProviders: ClientSideSafeAuthOptions[];
}) {
  const [submitting, setSubmitting] = useState(false);

  const providersThatAllowSignup = authProviders.filter((p) => p.provisionNewUser);
  const firebaseProvider = providersThatAllowSignup.find((p) => p.provider === 'firebase');
  const orcidProvider = providersThatAllowSignup.find((p) => p.provider === 'orcid');
  const googleProvider = providersThatAllowSignup.find((p) => p.provider === 'google');
  const oktaProvider = providersThatAllowSignup.find((p) => p.provider === 'okta');

  const showOrDivider =
    providersThatAllowSignup.length > 0 &&
    providersThatAllowSignup.map(({ provider }) => provider).includes('firebase');

  return (
    <div className="space-y-8">
      <div className="text-lg lg:text-xl">
        {config?.signup?.prompt ?? 'Choose a provider to create your account'}
      </div>
      <div className="flex flex-wrap justify-center py-2 gap-x-1 gap-y-2 min-w-xs">
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
        {oktaProvider && oktaProvider.allowLogin && (
          <okta.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
        )}
        {orcidProvider && orcidProvider.allowLogin && (
          <orcid.LoginUI disabled={submitting} setSubmitting={setSubmitting} className="w-full" />
        )}
      </div>
      {showOrDivider && <OrDivider />}
      {firebaseProvider && firebaseProvider.allowLogin && (
        <firebase.FirebasePasswordLoginUI
          disabled={submitting}
          setSubmitting={setSubmitting}
          notice={
            <div>
              To sign up, with username and password, first make an account on{' '}
              <a href="https://editor.curvenote.com" target="_blank" rel="noreferrer noopener">
                https://editor.curvenote.com
              </a>
            </div>
          }
        />
      )}
    </div>
  );
}

export default function Signup() {
  const { signupConfig, authProviders } = useDeploymentConfig();

  if (!signupConfig || !signupConfig.signup) {
    return (
      <div className="mx-auto my-32 lg:my-64">
        <h1>Signup is currently disabled.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {signupConfig.signup.mode === 'preferred' && (
        <PreferredSignupUI config={signupConfig} authProviders={authProviders} />
      )}
      {signupConfig.signup.mode === 'all' && (
        <AllSignupUI config={signupConfig} authProviders={authProviders} />
      )}
    </div>
  );
}
