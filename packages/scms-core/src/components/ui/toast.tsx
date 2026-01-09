import { toast as sonnerToast } from 'sonner';
import type { ExternalToast } from 'sonner';
import { CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToastOptions {
  description?: string;
  action?: {
    label: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  };
  cancel?: {
    label: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  };
  duration?: number;
}

interface CustomToastProps {
  message: ReactNode;
  description?: string;
  icon: LucideIcon;
  iconColor: string;
  titleColor: string;
  onCancel?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAction?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  cancelLabel?: string;
  actionLabel?: string;
}

function CustomToast({
  message,
  description,
  icon: Icon,
  iconColor,
  titleColor,
  onCancel,
  onAction,
  cancelLabel,
  actionLabel,
}: CustomToastProps) {
  return (
    <div className="flex gap-3 items-center p-4 rounded-lg border shadow-lg bg-background text-foreground border-border w-full max-w-sm min-w-[356px]">
      <Icon className={`flex-shrink-0 w-4 h-4 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${titleColor}`}>{message}</div>
        {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
      </div>
      {(onAction || onCancel) && (
        <div className="flex flex-shrink-0 gap-2">
          {onCancel && cancelLabel && (
            <button
              onClick={onCancel}
              className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/80"
            >
              {cancelLabel}
            </button>
          )}
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function toast(message: ReactNode, options?: ToastOptions) {
  return sonnerToast(message, options as ExternalToast);
}

export function toastSuccess(message: ReactNode, options?: ToastOptions) {
  return sonnerToast.custom(
    (t) => (
      <CustomToast
        message={message}
        description={options?.description}
        icon={CheckCircle}
        iconColor="text-green-600 dark:text-green-400"
        titleColor="text-green-800 dark:text-green-200"
        onCancel={
          options?.cancel
            ? (e) => {
                options.cancel?.onClick?.(e);
                sonnerToast.dismiss(t);
              }
            : undefined
        }
        onAction={
          options?.action
            ? (e) => {
                options.action?.onClick(e);
                sonnerToast.dismiss(t);
              }
            : undefined
        }
        cancelLabel={options?.cancel?.label}
        actionLabel={options?.action?.label}
      />
    ),
    { duration: options?.duration },
  );
}

export function toastError(message: ReactNode, options?: ToastOptions) {
  return sonnerToast.custom(
    (t) => (
      <CustomToast
        message={message}
        description={options?.description}
        icon={XCircle}
        iconColor="text-red-600 dark:text-red-400"
        titleColor="text-red-800 dark:text-red-200"
        onCancel={
          options?.cancel
            ? (e) => {
                options.cancel?.onClick?.(e);
                sonnerToast.dismiss(t);
              }
            : undefined
        }
        onAction={
          options?.action
            ? (e) => {
                options.action?.onClick(e);
                sonnerToast.dismiss(t);
              }
            : undefined
        }
        cancelLabel={options?.cancel?.label}
        actionLabel={options?.action?.label}
      />
    ),
    { duration: options?.duration },
  );
}

export function toastWarning(message: ReactNode, options?: ToastOptions) {
  return sonnerToast.custom(
    (t) => (
      <CustomToast
        message={message}
        description={options?.description}
        icon={AlertTriangle}
        iconColor="text-yellow-600 dark:text-yellow-400"
        titleColor="text-yellow-800 dark:text-yellow-200"
        onCancel={
          options?.cancel
            ? (e) => {
                options.cancel?.onClick?.(e);
                sonnerToast.dismiss(t);
              }
            : undefined
        }
        onAction={
          options?.action
            ? (e) => {
                options.action?.onClick(e);
                sonnerToast.dismiss(t);
              }
            : undefined
        }
        cancelLabel={options?.cancel?.label}
        actionLabel={options?.action?.label}
      />
    ),
    { duration: options?.duration },
  );
}

export function toastInfo(message: ReactNode, options?: ToastOptions) {
  return sonnerToast.info(message, {
    icon: <Info className="w-4 h-4" />,
    ...options,
  } as ExternalToast);
}

// Export the dismiss function for convenience
export const dismissToast = sonnerToast.dismiss;
export const dismissAllToasts = () => sonnerToast.dismiss();
