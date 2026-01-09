import { useFetcher } from 'react-router';
import logo from './orcid-logo-text.svg';
import logoDark from './orcid-logo-text-dark.svg';
import { useEffect } from 'react';
import { ProfileContentLayout } from '../common.js';
import type { ORCIDProfile } from './types.js';
import { Shield } from 'lucide-react';
import { StatefulButton } from '../../../components/ui/index.js';

export function Badge({
  className,
  size,
}: {
  className?: string;
  size?: number;
  showName?: boolean;
}) {
  const ratio = 68.52 / 18;
  return (
    <div className={className}>
      <img
        className="dark:hidden"
        src={logo}
        alt="ORCID Logo"
        width={ratio * (size ?? 20)}
        height={size ?? 20}
      />
      <img
        className="hidden dark:block"
        src={logoDark}
        alt="ORCID Logo"
        width={ratio * (size ?? 20)}
        height={size ?? 20}
      />
    </div>
  );
}

export function ProfileCardContent({
  profile,
  children,
}: React.PropsWithChildren<{ profile: ORCIDProfile }>) {
  return (
    <ProfileContentLayout
      content={
        <div className="flex items-center space-x-6 grow">
          <div className="flex items-center space-x-2">
            <img className="dark:hidden" src={logo} alt="ORCID" height={64} />
            <img className="hidden dark:block" src={logoDark} alt="ORCID" height={64} />
          </div>
          <div className="flex flex-col">
            <p title="Display Name">{profile.name}</p>
            <p title="email" className="flex items-center">
              {profile.email}
              {profile.emailVerified && (
                <span className="inline-block ml-[2px]" title="email is verified">
                  <Shield className="w-3 h-3 fill-blue-200 stroke-blue-600 dark:fill-stone-600 dark:stroke-stone-200" />
                </span>
              )}
            </p>
            <p title="ORCID" className="inline-block pt-1 font-mono text-xs text-stone-400">
              {profile.id}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ProfileContentLayout>
  );
}

export function LoginUI({
  disabled,
  setSubmitting,
  className,
}: {
  disabled?: boolean;
  setSubmitting: (flag: boolean) => void;
  className?: string;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      setSubmitting(true);
    } else setSubmitting(false);
  }, [fetcher.state]);

  return (
    <fetcher.Form method="post" action="/auth/orcid" aria-disabled={disabled} className="w-full">
      <StatefulButton
        variant="outline"
        type="submit"
        aria-label="Sign in with ORCID"
        disabled={disabled}
        busy={fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <img className="dark:hidden" src={logo} alt="ORCID Logo" width={68.52} height={18} />
        <img
          className="hidden dark:block"
          src={logoDark}
          alt="ORCID Logo"
          width={76.133}
          height={20}
        />
      </StatefulButton>
    </fetcher.Form>
  );
}
