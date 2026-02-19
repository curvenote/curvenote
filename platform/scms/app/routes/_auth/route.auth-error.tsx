import { Link, useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';

interface Error {
  error: boolean;
  provider?: string;
  status?: string;
  message?: string;
}

export default function LoginPage() {
  const [error, setError] = useState<Error | undefined>(undefined);
  const [params, setSearchParams] = useSearchParams();

  useEffect(() => {
    const err = params.get('error');
    const provider = params.get('provider');
    const status = params.get('status');
    const message = params.get('message');
    if (err) {
      setError({
        error: true,
        provider: provider ?? '',
        status: status ?? '',
        message: message ?? '',
      });
      setSearchParams({}, { replace: true });
    } else {
      setError(undefined);
    }
  }, []);

  return (
    <div className="flex flex-col justify-center px-4 py-12 mx-auto space-y-10 max-w-sm md:max-w-md lg:max-w-lg">
      <div className="flex flex-col space-y-6 w-full items-left">
        <h1 className="text-4xl font-light text-left">Authentication Error</h1>
        {error && (
          <div className="py-2 space-y-2">
            {error.message && <p className="text-lg text-foreground">{error.message}</p>}
            {error.provider && !error.message && (
              <p className="text-lg">
                Something went wrong during <span className="font-semibold">{error.provider}</span>{' '}
                sign-in.
              </p>
            )}
            {error?.status && <p className="text-sm text-muted-foreground">[{error.status}]</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <Link
            to="/login"
            className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
