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
    <div className="flex flex-col justify-center max-w-sm px-4 py-12 mx-auto space-y-10 md:max-w-md lg:max-w-lg">
      <div className="flex flex-col w-full space-y-6 items-left">
        <h1 className="text-4xl font-light text-left">Error</h1>
        {error && (
          <div className="py-2">
            <h2 className="text-2xl font-light">
              During{' '}
              {error.provider && (
                <>
                  <span className="font-semibold">{error?.provider}</span> authentication
                </>
              )}
              .
            </h2>
            {(error?.status || error?.message) && (
              <p className="text-lg">
                {error?.status && <span>[{error?.status}] </span>}
                {error?.message}
              </p>
            )}
          </div>
        )}
        <Link to="/app" className="flex items-center space-x-2 underline pointer-cursor">
          Back to App
        </Link>
      </div>
    </div>
  );
}
