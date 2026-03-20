import { useFetcher } from 'react-router';
import { useEffect } from 'react';
import { ProfileContentLayout } from '../common.js';
import type { BlueskyProfile } from './types.js';
import { StatefulButton } from '../../../components/ui/index.js';
import logo from './logo.svg';

export function Badge({
  className,
  size = 20,
  showName,
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
      <div className="flex items-center gap-2">
        <img
          src={logo}
          alt=""
          width={size}
          height={size}
          className="shrink-0"
          aria-hidden
        />
        {showName && <span>Bluesky</span>}
      </div>
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
          <div className="flex shrink-0 w-12 h-12">
            <img src={logo} alt="Bluesky" className="w-full h-full object-contain" />
          </div>
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
  returnTo,
}: {
  disabled?: boolean;
  setSubmitting: (flag: boolean) => void;
  className?: string;
  returnTo?: string;
}) {
  const fetcher = useFetcher();
  const action =
    returnTo != null ? `/auth/bluesky?returnTo=${encodeURIComponent(returnTo)}` : '/auth/bluesky';

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      setSubmitting(true);
    } else setSubmitting(false);
  }, [fetcher.state, setSubmitting]);

  return (
    <fetcher.Form method="post" action={action} aria-disabled={disabled} className="w-full">
      <StatefulButton
        variant="outline"
        type="submit"
        aria-label="Sign in with Bluesky"
        disabled={disabled}
        busy={fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <div className="flex items-center justify-center gap-2">
          <img src={logo} alt="" width={20} height={20} className="shrink-0" aria-hidden />
          <span style={{ fontWeight: 600, color: 'var(--bluesky-blue, #0085ff)' }}>Bluesky</span>
        </div>
      </StatefulButton>
    </fetcher.Form>
  );
}
