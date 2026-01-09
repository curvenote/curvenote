import React, { useEffect, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/index.js';
import type { FetcherWithComponents } from 'react-router';
import { ErrorMessage } from '../ui/ErrorMessage.js';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  lift?: boolean;
  validateUsing?: FetcherWithComponents<any>;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, lift = false, validateUsing, children, ...rest },
  ref,
) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (validateUsing?.data?.info && validateUsing.state !== 'submitting') {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [validateUsing?.data?.info, validateUsing?.state]);

  const hasMessage = validateUsing?.data?.error || (showSuccess && validateUsing?.data?.info);

  return (
    <div
      ref={ref}
      className={cn(
        'hide-scrollbar relative w-full overflow-hidden rounded-sm bg-white px-4 border-[1px] border-stone-200 dark:bg-stone-900 dark:border-stone-500 py-4 transition-[padding] duration-300 ease-in-out',
        {
          'shadow-[0px_1px_2px_0px_rgba(68,64,60,0.24),0px_1px_3px_0px_rgba(68,64,60,0.12)] ': lift,
          'pb-8': hasMessage,
        },
        className,
      )}
      {...rest}
    >
      {children}
      {validateUsing?.data?.error && (
        <>
          <div className="h-2" />
          <ErrorMessage
            className="absolute right-0 bottom-0 left-0"
            error={validateUsing.data.error}
          />
        </>
      )}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 p-1 text-sm text-center text-green-600 bg-green-100 transform transition-all duration-500 ease-in-out',
          showSuccess && validateUsing?.data?.info
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0',
        )}
      >
        <span>{validateUsing?.data?.info}</span>
      </div>
    </div>
  );
});
