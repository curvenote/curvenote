import { Form, useFetcher } from 'react-router';
import logo from './okta-logo.svg';
import logoDark from './okta-logo-dark.svg';
import icon from './icon.svg';
import { useEffect, useState } from 'react';
import type { OktaProfile } from '@curvenote/remix-auth-okta';
import { ProfileContentLayout } from '../common.js';
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
        className="bg-cover dark:invert"
        src={icon}
        alt="OKTA"
        height={size ?? 20}
        width={size ?? 20}
      />
      {showName && <div>OKTA</div>}
    </div>
  );
}

export function ProfileCardContent({
  profile,
  children,
}: React.PropsWithChildren<{ profile: OktaProfile }>) {
  return (
    <ProfileContentLayout
      content={
        <div className="flex items-center space-x-6 grow">
          <img className="block dark:invert" src={icon} alt="OKTA" width={48} height={48} />
          <div className="flex flex-col">
            <p title="Display name">{profile.name}</p>
            <p title="email" className="flex items-center">
              {profile.email}
              {profile.email_verified && (
                <span className="inline-block ml-[2px]" title="email is verified">
                  <Shield className="w-3 h-3 fill-blue-200 stroke-blue-600 dark:fill-stone-600 dark:stroke-stone-200" />
                </span>
              )}
            </p>
            <p title="UID" className="inline-block pt-1 font-mono text-xs text-stone-400">
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
  disabled: boolean;
  setSubmitting: (flag: boolean) => void;
  className?: string;
}) {
  const fetcher = useFetcher();
  const [eagerBusy, setEagerBusy] = useState(false);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      setSubmitting(true);
    } else setSubmitting(false);
  }, [fetcher.state]);

  return (
    <Form
      method="post"
      action="/auth/okta"
      aria-disabled={disabled}
      onSubmit={() => setEagerBusy(true)}
      className="w-full"
    >
      <StatefulButton
        variant="outline"
        type="submit"
        disabled={disabled}
        busy={eagerBusy || fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <div>
          <img className="mt-[3px] bg-cover dark:hidden" src={logo} alt="Sign in with OKTA" />
          <img className="hidden bg-contain dark:block" src={logoDark} alt="Sign in with OKTA" />
        </div>
      </StatefulButton>
    </Form>
  );
}
