import type { Route } from './+types/route.signup';
import { redirect } from 'react-router';
import { useState } from 'react';
import { ui, useDeploymentConfig, SignupProviderButtons } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';
import type { ClientSigninSignupConfig, ClientSideSafeAuthOptions } from '@curvenote/scms-core';
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
        {showMoreProviders && <div className="space-y-2">{MoreProvidersUI}</div>}
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

  return (
    <div className="space-y-8">
      <div className="text-lg lg:text-xl">
        {config?.signup?.prompt ?? 'Choose a provider to create your account'}
      </div>
      <div className="w-full max-w-xs">
        <SignupProviderButtons
          authProviders={authProviders}
          submitting={submitting}
          setSubmitting={setSubmitting}
          className="w-full"
        />
      </div>
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
