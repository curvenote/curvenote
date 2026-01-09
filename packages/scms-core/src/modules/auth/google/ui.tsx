import { useFetcher } from 'react-router';
import logo from './logo.svg';
import { useEffect } from 'react';
import { ProfileContentLayout } from '../common.js';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar.js';
import type { FirebaseProfile } from '../firebase/types.js';
import { cn } from '../../../utils/cn.js';
import { Shield } from 'lucide-react';
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
    <div className={cn('flex items-center space-x-2', className)}>
      <img
        className="dark:hidden"
        src={logo}
        alt="Google"
        width={size ?? 20}
        height={size ?? 20}
        title="Google"
      />
      {showName && <div>Google</div>}
    </div>
  );
}

export function ProfileCardContent({
  profile,
  children,
}: React.PropsWithChildren<{ profile: FirebaseProfile }>) {
  return (
    <ProfileContentLayout
      content={
        <div className="flex items-center space-x-6 grow">
          <div className="min-w-[48px]">
            <img className="block" src={logo} alt="Google" width={48} height={48} />
          </div>
          <div className="flex flex-col">
            <p title="Display name">{profile.displayName}</p>
            <p title="email" className="flex items-center">
              {profile.email}
              {profile.emailVerified && (
                <span className="inline-block ml-[2px]" title="email is verified">
                  <Shield className="w-3 h-3 fill-blue-200 stroke-blue-600 dark:fill-stone-600 dark:stroke-stone-200" />
                </span>
              )}
            </p>
            <p title="UID" className="inline-block pt-1 font-mono text-xs text-stone-400">
              {profile.uid}
            </p>
          </div>
          <Avatar className="hidden w-16 h-16 md:block">
            <AvatarImage src={profile.photoURL} alt={profile.displayName} />
            <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
          </Avatar>
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
  disabled: boolean;
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
    <fetcher.Form method="post" action="/auth/google" aria-disabled={disabled}>
      <StatefulButton
        variant="outline"
        type="submit"
        disabled={disabled || fetcher.state !== 'idle'}
        busy={fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <div className="flex items-center justify-center space-x-1">
          <img src={logo} alt="Sign in with Google" width={20} height={20} />
          <div>Google</div>
        </div>
      </StatefulButton>
    </fetcher.Form>
  );
}
