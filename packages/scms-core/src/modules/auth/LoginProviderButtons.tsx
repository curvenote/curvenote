import type { ClientSideSafeAuthOptions } from './types.js';
import { FirebaseGoogleLoginUI } from './firebase/index.js';
import { LoginUI as GitHubLoginUI } from './github/index.js';
import { LoginUI as GoogleLoginUI } from './google/index.js';
import { LoginUI as OktaLoginUI } from './okta/index.js';
import { LoginUI as OrcidLoginUI } from './orcid/index.js';

export type ProviderButtonsProps = {
  /** Auth providers from deployment config (e.g. useDeploymentConfig().authProviders). */
  authProviders: ClientSideSafeAuthOptions[];
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  /** Applied to each provider button (e.g. "w-full" or "w-full h-10"). */
  className?: string;
  /** When set, auth flows redirect back to this URL after sign-in (e.g. form page path). */
  returnTo?: string;
};

const PROVIDER_UIS = {
  orcid: OrcidLoginUI,
  github: GitHubLoginUI,
  google: GoogleLoginUI,
  firebase: FirebaseGoogleLoginUI,
  okta: OktaLoginUI,
} as const;

function ProviderButtons({
  providers,
  submitting,
  setSubmitting,
  className = 'w-full',
  returnTo,
}: {
  providers: ClientSideSafeAuthOptions[];
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  className?: string;
  returnTo?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => {
        const UI = PROVIDER_UIS[p.provider as keyof typeof PROVIDER_UIS];
        if (!UI) return null;
        return (
          <UI
            key={p.provider}
            disabled={submitting}
            setSubmitting={setSubmitting}
            className={className}
            returnTo={returnTo}
          />
        );
      })}
    </div>
  );
}
/**
 * Renders sign-in buttons for all enabled login providers (with allowLogin=true).
 * Button order follows the order of authProviders from config.
 */
export function LoginProviderButtons({
  authProviders,
  submitting,
  setSubmitting,
  className = 'w-full',
  returnTo,
}: ProviderButtonsProps) {
  return ProviderButtons({
    providers: (authProviders ?? []).filter((p) => p.allowLogin),
    submitting,
    setSubmitting,
    className,
    returnTo,
  });
}

/**
 * Renders sign-up buttons for all enabled signup providers (with provisionNewUser=true).
 * Button order follows the order of authProviders from config.
 */
export function SignupProviderButtons({
  authProviders,
  submitting,
  setSubmitting,
  className = 'w-full',
  returnTo,
}: ProviderButtonsProps) {
  return ProviderButtons({
    providers: (authProviders ?? []).filter((p) => p.provisionNewUser),
    submitting,
    setSubmitting,
    className,
    returnTo,
  });
}
