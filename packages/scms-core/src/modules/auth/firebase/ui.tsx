import { useFetcher, useSearchParams } from 'react-router';
import logo from './logo.svg';
import { auth as clientAuth } from '../../../modules/database/firebase/firebase.client.js';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useState } from 'react';
import { TextField } from '../../../components/primitives/index.js';
import type { FirebaseError } from 'firebase-admin/app';
import { ProfileContentLayout } from '../common.js';
import type { FirebaseProfile } from './types.js';
import { Mail, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar.js';
import { StatefulButton } from '../../../components/ui/index.js';
import { SimpleAlert } from '../../../components/ui/SimpleAlert.js';

export function FirebaseEmailBadge({ size, showName }: { size?: number; showName?: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <Mail size={size ?? 20} />
      {showName && <div>Firebase Email</div>}
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
          <div className="flex items-center space-x-2">
            <img src={logo} alt="Google" width={48} height={48} />
          </div>
          <div className="flex flex-col">
            <h2>Firebase Email</h2>
            <div title="Display Name">{profile.displayName}</div>
            <div title="email">
              {profile.email}
              {profile.emailVerified && <Shield />}
            </div>
            <div title="UID" className="inline-block pt-1 font-mono text-xs text-stone-400">
              {profile.uid}
            </div>
          </div>
          <Avatar className="w-16 h-16">
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

export function FirebaseGoogleLoginUI({
  disabled,
  setSubmitting: setSubmitting,
  className,
}: {
  disabled: boolean;
  setSubmitting: (flag: boolean) => void;
  className?: string;
}) {
  const fetcher = useFetcher();
  const [iAmSubmitting, setIAmSubmitting] = useState(false);

  async function handleGoogleSignin() {
    setSubmitting?.(true);
    setIAmSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(clientAuth, provider);
      const idToken = await credential.user.getIdToken();
      fetcher.submit({ idToken }, { method: 'POST', action: '/auth/firebase' });
    } catch (error: any) {
      console.error(error);
      setIAmSubmitting?.(false);
    }
  }

  return (
    <div className="flex justify-center w-full">
      <StatefulButton
        variant="outline"
        onClick={handleGoogleSignin}
        disabled={disabled || iAmSubmitting}
        busy={iAmSubmitting || fetcher.state !== 'idle'}
        overlayBusy
        className={className}
      >
        <div className="flex items-center justify-center space-x-1">
          <img src={logo} alt="Sign in with Google" width={20} height={20} />
          <div>Google</div>
        </div>
      </StatefulButton>
    </div>
  );
}

export function FirebasePasswordLoginUI({
  disabled,
  label,
  notice,
}: {
  disabled?: boolean;
  label?: string;
  notice?: React.ReactNode;
  setSubmitting: (flag: boolean) => void;
}) {
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/app';
  const [iAmSubmitting, setIAmSubmitting] = useState(false);
  const [clientSideError, setClientSideError] = useState<{
    email?: string;
    password?: string;
    other?: string;
  } | null>(null);

  async function handleUserPassSubmit(e: React.SyntheticEvent) {
    setIAmSubmitting(true);

    e.preventDefault();
    const target = e.target as typeof e.target & {
      email: { value: string };
      password: { value: string };
    };

    setTimeout(async () => {
      const email = target.email.value;
      const password = target.password.value;

      let error = null;
      if (!email || email.length === 0) {
        error = { email: 'please provide an email' };
      }
      if (!password || password.length === 0) {
        error = { ...error, password: 'please provide a password' };
      }

      if (error) {
        setClientSideError(error);
        setIAmSubmitting(false);
        return;
      }

      setClientSideError(null);

      try {
        const credential = await signInWithEmailAndPassword(clientAuth, email, password);
        const idToken = await credential.user.getIdToken();

        // Trigger a POST request to submit the token to the server
        fetcher.submit({ idToken }, { method: 'POST', action: '/auth/firebase' });
      } catch (err: any) {
        const fbError = err as FirebaseError;
        console.error(fbError);
        switch (err.code) {
          case 'auth/invalid-email':
            setClientSideError({ email: 'Invalid email' });
            break;
          case 'auth/user-not-found':
            setClientSideError({ email: 'User not found' });
            break;
          case 'auth/wrong-password':
            setClientSideError({ password: 'Incorrect password' });
            break;
          default:
            setClientSideError({ other: err.message ?? 'Unknown error' });
        }
        setIAmSubmitting(false);
      }
    }, 10);
  }

  return (
    <div className="flex justify-center w-full">
      <fetcher.Form
        method="post"
        className="w-full space-y-2"
        noValidate
        onSubmit={handleUserPassSubmit}
      >
        {notice && (
          <SimpleAlert type="info" size="compact" message={notice} className="max-w-xs mb-4" />
        )}
        <TextField
          id="email"
          label="Email address"
          required
          name="email"
          type="email"
          placeholder="name@domain.com"
          disabled={disabled || fetcher.state !== 'idle' || iAmSubmitting}
          error={clientSideError?.email} // ?? actionData?.errors?.email}
          aria-invalid={!!clientSideError?.email} //actionData?.errors?.email ? true : undefined}
          aria-describedby="email-error"
        />
        <TextField
          id="password"
          label="Password"
          required
          name="password"
          type="password"
          disabled={disabled || fetcher.state !== 'idle' || iAmSubmitting}
          placeholder="password"
          error={clientSideError?.password} // ?? actionData?.errors?.password}
          aria-invalid={!!clientSideError?.password} //actionData?.errors?.password ? true : undefined}
          aria-describedby="password-error"
        />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="py-4 space-y-4">
          <StatefulButton
            type="submit"
            className="w-full"
            disabled={disabled || fetcher.state !== 'idle'}
            busy={fetcher.state !== 'idle' || iAmSubmitting}
            overlayBusy
          >
            {label ?? 'Sign In'}
          </StatefulButton>
          {clientSideError?.other && (
            <span className="text-xs text-red-700 dark:text-red-700">{clientSideError.other}</span>
          )}
          <div className="flex items-center justify-between">
            <a
              href="https://curvenote.com/sso/reset"
              className="block text-sm tracking-wide underline text-stone-600 dark:text-stone-300"
              target="_blank"
              rel="noreferrer noopener"
            >
              Reset password
            </a>
          </div>
        </div>
      </fetcher.Form>
    </div>
  );
}
