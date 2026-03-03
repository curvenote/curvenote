import type { Route } from './+types/route';
import { useFetcher, Link, data } from 'react-router';
import { useState, useEffect } from 'react';
import { primitives, getFetcherField } from '@curvenote/scms-core';
import { verifyEmail } from '@curvenote/scms-server';
import { CheckCircle, XCircle } from 'lucide-react';
import { CurvenoteText } from '@curvenote/icons';

export async function action(args: Route.ActionArgs) {
  const url = new URL(args.request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return data({ error: 'Missing verification token' }, { status: 400 });
  }

  try {
    await verifyEmail.dbVerifyEmailWithToken(token);
    return {
      success: true,
      message: 'Your email has been verified successfully.',
    };
  } catch (error) {
    console.error('Verify email error:', error);
    return data(
      {
        error:
          error instanceof Error ? error.message : 'This verification link is invalid or has expired.',
      },
      { status: 400 },
    );
  }
}

export default function VerifyEmailPage() {
  const verifyFetcher = useFetcher<typeof action>();
  const [hasVerified, setHasVerified] = useState(false);
  const error = getFetcherField(verifyFetcher.data, 'error');
  const success = getFetcherField(verifyFetcher.data, 'success');
  const message = getFetcherField(verifyFetcher.data, 'message');

  const [missingToken, setMissingToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasVerified && verifyFetcher.state === 'idle' && !verifyFetcher.data) {
      const url = new URL(typeof window !== 'undefined' ? window.location.href : '');
      const token = url.searchParams.get('token');
      if (token) {
        verifyFetcher.submit({}, { method: 'post' });
        setHasVerified(true);
      } else {
        setMissingToken(true);
      }
    }
  }, [hasVerified, verifyFetcher]);

  if (missingToken) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <primitives.Card className="p-6 text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Invalid link</h1>
          <p className="mb-6 text-sm text-gray-500">
            This verification link is invalid or missing a token. Please request a new
            verification email from your account settings.
          </p>
          <Link
            to="/app/settings/account"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Go to Account Settings
          </Link>
        </primitives.Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <primitives.Card className="p-6 text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Verification Failed</h1>
          <p className="mb-6 text-sm text-gray-500">{error}</p>
          <p className="text-sm text-gray-500">
            You can request a new verification email from your account settings.
          </p>
          <div className="mt-6">
            <Link
              to="/app/settings/account"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Go to Account Settings
            </Link>
          </div>
        </primitives.Card>
        <div className="mt-8 text-center">
          <a
            href="https://curvenote.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <CurvenoteText className="h-4" />
          </a>
        </div>
      </div>
    );
  }

  if (success && message) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <primitives.Card className="p-6 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Email Verified</h1>
          <p className="mb-6 text-sm text-gray-500">{message}</p>
          <div className="mt-3">
            <Link
              to="/app"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Go to dashboard
            </Link>
          </div>
        </primitives.Card>
        <div className="mt-8 text-center">
          <a
            href="https://curvenote.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <CurvenoteText className="h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <primitives.Card className="p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Verifying your email</h1>
        <p className="text-sm text-gray-500">
          {verifyFetcher.state === 'submitting' ? 'Please wait...' : 'Loading...'}
        </p>
      </primitives.Card>
      <div className="mt-8 text-center">
        <a
          href="https://curvenote.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <CurvenoteText className="h-4" />
        </a>
      </div>
    </div>
  );
}
