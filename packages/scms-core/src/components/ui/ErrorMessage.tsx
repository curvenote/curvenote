import type { GeneralError } from '../../backend/types.js';
import { cn } from '../../utils/cn.js';

export function ErrorMessage({
  error,
  className,
}: {
  error:
    | string
    | GeneralError
    | Array<{ code: string; path: string[]; expected: string; received: string }>;
  className?: string;
}) {
  const isArray = Array.isArray(error);
  let message = 'Unknown error';
  if (!isArray) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error as string;
    } else {
      message = JSON.stringify(error);
    }
  }

  return (
    <div
      className={cn(
        'px-2 py-1 my-0 text-sm text-red-600 transition-all duration-500 ease-in-out transform translate-y-0 bg-red-100 opacity-100',
        className,
      )}
    >
      {Array.isArray(error) ? (
        error.map((e: any, i: number) => (
          <div key={`error-${e.path.join('.')}-${i}`}>
            {e.code} {e.path.join('.')} expected: {e.expected} received: {e.received}
          </div>
        ))
      ) : (
        <div className="text-center">{message}</div>
      )}
    </div>
  );
}
