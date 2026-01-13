import { Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';

export interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  message: string | React.ReactNode;
  size?: 'normal' | 'compact';
  numbered?: number;
  className?: string;
}

const typeStyles = {
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-l-4 border-blue-400 dark:border-blue-500',
    iconColor: 'text-blue-400 dark:text-blue-500',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50 dark:bg-green-950/50',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-l-4 border-green-400 dark:border-green-500',
    iconColor: 'text-green-400 dark:text-green-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50 dark:bg-yellow-950/50',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-l-4 border-yellow-400 dark:border-yellow-500',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-950/50',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-l-4 border-red-400 dark:border-red-500',
    iconColor: 'text-red-400 dark:text-red-500',
  },
  neutral: {
    icon: Info,
    bg: 'bg-gray-50 dark:bg-gray-950/50',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-l-4 border-gray-400 dark:border-gray-500',
    iconColor: 'text-gray-400 dark:text-gray-500',
  },
};

export function SimpleAlert({ type, message, size = 'normal', numbered, className }: AlertProps) {
  const style = typeStyles[type];
  const Icon = style.icon;

  const sizeStyles = {
    normal: {
      container: 'p-5',
      text: 'text-base',
      gap: 'gap-4',
    },
    compact: {
      container: 'p-3',
      text: 'text-sm',
      gap: 'gap-2',
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <div
      className={cn(
        'flex items-top prose min-w-full', // removed rounded-md
        currentSize.container,
        currentSize.gap,
        style.bg,
        style.text,
        style.border,
        className,
      )}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {numbered !== undefined ? (
        <div className="flex h-full items-top">
          <div
            className={cn(
              'flex justify-center items-center w-7 h-7 text-lg font-semibold rounded-full border min-w-7 min-h-7',
              style.iconColor,
              style.border,
              'border-2',
            )}
          >
            <div>{numbered}</div>
          </div>
        </div>
      ) : (
        <Icon
          className={cn('w-6 h-6 flex-shrink-0 self-start mt-[2px]', style.iconColor, {
            'w-4 h-4': size === 'compact',
          })}
          aria-hidden="true"
        />
      )}
      <span className={cn(style.text, currentSize.text)}>{message}</span>
    </div>
  );
}
