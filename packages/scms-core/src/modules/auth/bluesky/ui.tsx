import { useFetcher } from 'react-router';
import { useEffect } from 'react';
import { ProfileContentLayout } from '../common.js';
import type { BlueskyProfile } from './types.js';
import { StatefulButton } from '../../../components/ui/index.js';

export function Badge({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
  showName?: boolean;
}) {
  return (
    <div
      className={className}
      style={{ fontSize: size, fontWeight: 600, color: 'var(--bluesky-blue, #0085ff)' }}
    >
      Bluesky
    </div>
  );
}

export function ProfileCardContent({
  profile,
  children,
}: React.PropsWithChildren<{ profile: BlueskyProfile }>) {
  return (
    <ProfileContentLayout
      content={
        <div className="flex items-center space-x-6 grow">
          <div className="flex flex-col">
            <p title="Display Name">{profile.displayName ?? profile.handle ?? 'Bluesky user'}</p>
            {profile.handle && (
              <p title="handle" className="text-stone-500">
                @{profile.handle}
              </p>
            )}
            <p title="DID" className="inline-block pt-1 font-mono text-xs text-stone-400">
              {profile.did}
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
    <fetcher.Form method="post" action="/auth/bluesky" aria-disabled={disabled} className="w-full">
      <StatefulButton
        variant="outline"
        type="submit"
        aria-label="Sign in with Bluesky"
        disabled={disabled}
        busy={fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <span style={{ fontWeight: 600, color: 'var(--bluesky-blue, #0085ff)' }}>Bluesky</span>
      </StatefulButton>
    </fetcher.Form>
  );
}
