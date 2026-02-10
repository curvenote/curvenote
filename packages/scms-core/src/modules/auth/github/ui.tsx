import { useFetcher } from 'react-router';
import { useEffect } from 'react';
import { ProfileContentLayout } from '../common.js';
import type { GitHubProfile } from './types.js';
import { Github, Shield } from 'lucide-react';
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
      <Github size={size ?? 20} strokeWidth={1.5} />
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
          <Github className="flex-shrink-0" size={48} strokeWidth={1.5} />
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
}: {
  disabled?: boolean;
  setSubmitting: (flag: boolean) => void;
  className?: string;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      setSubmitting(true);
    } else {
      setSubmitting(false);
    }
  }, [fetcher.state, setSubmitting]);

  return (
    <fetcher.Form method="post" action="/auth/github" aria-disabled={disabled} className="w-full">
      <StatefulButton
        variant="outline"
        type="submit"
        aria-label="Sign in with GitHub"
        disabled={disabled}
        busy={fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <Github className="w-5 h-5 mr-2" strokeWidth={1.5} />
        Sign in with GitHub
      </StatefulButton>
    </fetcher.Form>
  );
}
