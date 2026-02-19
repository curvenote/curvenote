import { useFetcher } from 'react-router';
import { useEffect } from 'react';
import { ProfileContentLayout } from '../common.js';
import type { GitHubProfile } from './types.js';
import { Shield } from 'lucide-react';
import { GithubIcon } from '@scienceicons/react/24/solid';
import { StatefulButton } from '../../../components/ui/index.js';

export function Badge({
  className,
  size,
  showName,
}: {
  className?: string;
  size?: number;
  showName?: boolean;
}) {
  return (
    <div className={`flex items-center space-x-2 ${className ?? ''}`}>
      <GithubIcon style={{ width: size ?? 20, height: size ?? 20 }} />
      {showName && <span>GitHub</span>}
    </div>
  );
}

export function ProfileCardContent({
  profile,
  children,
}: React.PropsWithChildren<{ profile: GitHubProfile }>) {
  return (
    <ProfileContentLayout
      content={
        <div className="flex items-center space-x-6 grow">
          <GithubIcon className="flex-shrink-0 w-12 h-12" />
          <div className="flex flex-col">
            <p title="Display Name">{profile.name ?? profile.login}</p>
            <p title="email" className="flex items-center">
              {profile.email ?? '—'}
              {profile.email && (
                <span className="inline-block ml-[2px]" title="email from GitHub">
                  <Shield className="w-3 h-3 fill-blue-200 stroke-blue-600 dark:fill-stone-600 dark:stroke-stone-200" />
                </span>
              )}
            </p>
            <p title="GitHub login" className="inline-block pt-1 font-mono text-xs text-stone-400">
              @{profile.login}
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
  returnTo,
}: {
  disabled?: boolean;
  setSubmitting: (flag: boolean) => void;
  className?: string;
  returnTo?: string;
}) {
  const fetcher = useFetcher();
  const action =
    returnTo != null ? `/auth/github?returnTo=${encodeURIComponent(returnTo)}` : '/auth/github';

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      setSubmitting(true);
    } else {
      setSubmitting(false);
    }
  }, [fetcher.state, setSubmitting]);

  return (
    <fetcher.Form method="post" action={action} aria-disabled={disabled} className="w-full">
      <StatefulButton
        variant="outline"
        type="submit"
        aria-label="Sign in with GitHub"
        disabled={disabled}
        busy={fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <span className="inline-flex items-center whitespace-nowrap">
          <GithubIcon className="mr-1.5 w-5 h-5 shrink-0" />
          GitHub
        </span>
      </StatefulButton>
    </fetcher.Form>
  );
}
