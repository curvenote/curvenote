import type { Route } from './+types/route.login.admin';
import { useDeploymentConfig, google, okta, orcid, firebase } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';
import { redirect, useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const adminAuthProviders = Object.values(ctx.$config.auth ?? {}).filter(
    (p: { adminLogin: boolean }) => p.adminLogin,
  );
  if (adminAuthProviders.length === 0) {
    throw redirect('/login');
  }
  return null;
}

interface Error {
  error: boolean;
  provider?: string;
  status?: string;
  message?: string;
}

function OrDivider() {
  return (
    <div className="flex items-center w-full gap-2">
      <div className="w-full h-[1px] bg-stone-400 dark:bg-stone-600" />
      <div className="px-2 font-light bg-inherit text-stone-600 dark:text-stone-400">or</div>
      <div className="w-full h-[1px] bg-stone-400 dark:bg-stone-600" />
    </div>
  );
}

export default function LoginArea() {
  const { authProviders } = useDeploymentConfig();
  const [error, setError] = useState<Error | undefined>(undefined);
  const [params, setSearchParams] = useSearchParams();

  useEffect(() => {
    const err = params.get('error');
    const provider = params.get('provider');
    const status = params.get('status');
    const message = params.get('message');
    if (err) {
      setError({
        error: true,
        provider: provider ?? '',
        status: status ?? '',
        message: message ?? '',
      });
      setSearchParams({}, { replace: true });
    } else {
      setError(undefined);
    }
  }, []);

  // there is a more remix way to do this with useFetchers
  // but firebase spoils it
  const [submitting, setSubmitting] = useState(false);

  const adminProviders = authProviders.filter((p) => p.adminLogin);

  const showOrDivider =
    adminProviders.length > 0 &&
    adminProviders.map(({ provider }) => provider).includes('firebase');
  const firebaseProvider = adminProviders.find((p) => p.provider === 'firebase');
  const orcidProvider = adminProviders.find((p) => p.provider === 'orcid');
  const googleProvider = adminProviders.find((p) => p.provider === 'google');
  const oktaProvider = adminProviders.find((p) => p.provider === 'okta');
  return (
    <div className="flex flex-col items-center w-full space-y-10">
      <h1 className="mt-0 font-light text-center lg:text-2xl">Administrator Sign in</h1>
      {error && (
        <div className="px-3 py-2 text-red-500 bg-red-100 border border-red-500 rounded">
          <h2 className="text-sm font-semibold">
            Could not sign in{error.provider && <span> using {error?.provider}</span>}.
          </h2>
          {(error?.status || error?.message) && (
            <p className="text-sm text-red-500">
              {error?.status && <span>[{error?.status}] </span>}
              {error?.message}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-center max-w-xs gap-x-1 gap-y-2">
        {firebaseProvider && (
          <firebase.FirebaseGoogleLoginUI disabled={submitting} setSubmitting={setSubmitting} />
        )}
        {googleProvider && <google.LoginUI disabled={submitting} setSubmitting={setSubmitting} />}
        {oktaProvider && <okta.LoginUI disabled={submitting} setSubmitting={setSubmitting} />}
        {orcidProvider && <orcid.LoginUI disabled={submitting} setSubmitting={setSubmitting} />}
      </div>
      {showOrDivider && <OrDivider />}
      {firebaseProvider && (
        <firebase.FirebasePasswordLoginUI disabled={submitting} setSubmitting={setSubmitting} />
      )}
    </div>
  );
}
