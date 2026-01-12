import { Trash2, FileText, CloudDownload, Image, Video, Table, Pencil } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import type { FileState, FileUpload as BaseFileUpload } from './types.js';
import { useFetcher } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState, useRef } from 'react';
import { submitCompletedFile } from './utils.js';
import type { GeneralError } from '../../backend/types.js';
import { InlineEditable } from '../ui/InlineEditable.js';
import { SimpleTooltip } from '../ui/tooltip.js';

// Extend FileUpload to allow for downloadUrl from metadata (TODO: update upstream type if needed)
type FileUpload = BaseFileUpload & { downloadUrl?: string };

interface FileIconProps {
  upload: FileUpload;
  iconType: 'file' | 'image' | 'video' | 'table';
  label?: string;
}

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function FileIcon({ upload, iconType, label }: FileIconProps) {
  // Icon: render as link if completed and signedUrl exists, otherwise as plain icon
  if (upload.status === 'completed' && upload.signedUrl) {
    return (
      <a
        href={upload.signedUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-row max-w-full gap-1 cursor-pointer group w-fit"
        title={`Download ${upload.name}`}
      >
        <CloudDownload className="w-6 h-6 text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-300" />
        {label && (
          <span className="self-center block max-w-full text-sm font-medium underline truncate cursor-pointer text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100">
            {label}
          </span>
        )}
      </a>
    );
  }

  // Render appropriate icon based on type using a dictionary
  const iconMap: Record<string, JSX.Element> = {
    image: <Image className="w-6 h-6 text-stone-500 dark:text-stone-400" />,
    video: <Video className="w-6 h-6 text-stone-500 dark:text-stone-400" />,
    table: <Table className="w-6 h-6 text-stone-500 dark:text-stone-400" />,
    file: <FileText className="w-6 h-6 text-stone-500 dark:text-stone-400" />,
  };
  return (
    <div className="flex flex-row gap-1">
      {iconMap[iconType] ?? iconMap['file']}
      {label && (
        <span className="self-center block max-w-full text-sm font-medium underline truncate text-stone-700 dark:text-stone-300">
          {label}
        </span>
      )}
    </div>
  );
}

interface StatusMessageProps {
  status: string;
  error?: { message: string; details?: any };
  isPending: boolean;
  className?: string;
}

function StatusMessage({ status, error, isPending, className }: StatusMessageProps) {
  let message = status as string;
  if (status === 'completed') {
    message = 'Upload completed';
  } else if (status === 'error') {
    // Check if this is a file size error with maxSize details
    if (error?.message === 'File size too large' && error?.details?.maxSize) {
      message = `File size too large (max: ${formatBytes(error.details.maxSize)})`;
    } else {
      message = error?.message ?? 'Upload failed';
    }
  } else if (status === 'pending' || status === 'staged') {
    message = 'Uploading...';
  } else if (status === 'uploaded') {
    message = 'Verifying...';
  }

  return (
    <div
      className={cn('text-xs cursor-default', className, {
        'text-stone-500': status === 'uploading' || status === 'uploaded' || isPending,
        'text-green-500': status === 'completed',
        'text-red-500': status === 'error',
      })}
      title={error?.message}
    >
      {message}
    </div>
  );
}

interface ProgressBarProps {
  status: string;
  progress: number;
  isPending: boolean;
  className?: string;
}

function ProgressBar({ status, progress, isPending, className }: ProgressBarProps) {
  return (
    <div className={className}>
      <div className="w-full bg-stone-200 rounded-full h-1.5">
        <div
          className={cn('h-1.5 rounded-full transition-all duration-300', {
            'bg-blue-500': status === 'uploading' || status === 'uploaded' || isPending,
            'bg-green-500': status === 'completed',
            'bg-red-500': status === 'error',
            'w-full': progress === 100 || status === 'error',
          })}
          style={{ width: status === 'error' ? '100%' : `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface RemoveButtonProps {
  slot: string;
  upload: FileUpload;
  onSetFileState: Dispatch<SetStateAction<FileState>>;
  onError: (error: GeneralError | undefined) => void;
  fetcher: ReturnType<
    typeof useFetcher<{
      success?: boolean;
      error?: GeneralError;
    }>
  >;
}

function RemoveButton({ slot, upload, onSetFileState, onError, fetcher }: RemoveButtonProps) {
  useEffect(() => {
    if (fetcher.data && 'error' in fetcher.data) {
      onError(fetcher.data.error);
    } else if (fetcher.data && 'success' in fetcher.data) {
      onSetFileState((prev) => {
        const newState = { ...prev };
        delete newState[upload.path];
        return newState;
      });
      onError(undefined);
    }
  }, [fetcher.data]);

  /**
   * Handles file removal
   * - Removes file from local state
   * - Submits removal intent to server
   */
  const removeFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Submit removal to server
    const formData = new FormData();
    formData.append('intent', 'remove');
    formData.append('slot', slot);
    formData.append('path', upload.path);
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <fetcher.Form method="POST" onSubmit={removeFile} className="absolute -top-2 -right-2">
      <SimpleTooltip title="Delete file" side="right" sideOffset={10} delayDuration={250}>
        <button
          type="submit"
          className="p-1.5 bg-stone-100 border border-stone-400 dark:bg-stone-600 dark:border-stone-600 rounded-full hover:bg-stone-50 dark:hover:bg-stone-500 shadow-sm z-20 cursor-pointer"
          aria-label="Remove file"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </SimpleTooltip>
    </fetcher.Form>
  );
}

interface WorkFileCardProps {
  slot: string;
  upload: FileUpload;
  onSetFileState: Dispatch<SetStateAction<FileState>>;
  onError: (error: GeneralError | undefined) => void;
  readonly?: boolean;
  iconType?: 'file' | 'image' | 'video' | 'table';
  validateLabel?: (label: string, path: string) => string | null;
  showLabel?: boolean;
  isHighlighted?: boolean; // NEW: prop to trigger pulse animation
}

/*
This is the representation of a file that is associated with a work. It is used in the work file upload as intended to
relate to a file section within a work version metadata field.

It's intended for persistent storage of individually identified files thst are part of a WorkVersion.

*/
export function WorkFileCard({
  slot,
  upload,
  onSetFileState,
  onError,
  readonly = false,
  iconType = 'file',
  validateLabel,
  showLabel = true,
  isHighlighted,
}: WorkFileCardProps) {
  const [hideStatus, setHideStatus] = useState(upload.status === 'completed');
  const [hasSeenNonCompleted, setHasSeenNonCompleted] = useState(upload.status !== 'completed');
  const [labelError, setLabelError] = useState<string | null>(null);
  const inlineEditableRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLabelError(null);
  }, [upload.label]);

  // Scroll into view when highlighted
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      // Add a small delay to ensure the highlight animation starts first
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [isHighlighted]);

  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError;
    error_items?: { path: string; error: string; details?: any }[];
  }>();

  const removeFetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError;
  }>();

  useEffect(() => {
    // Submit completed file when status is uploaded
    if (upload.status === 'uploaded') {
      submitCompletedFile(fetcher, slot, {
        path: upload.path,
        content_type: upload.type,
        size: upload.size,
        md5: upload.md5,
        label: upload.label,
      });
    }
  }, [upload]);

  // Handle per-file errors from fetcher.data.error_items
  useEffect(() => {
    if (!fetcher.data) return;

    const data = fetcher.data as any;

    // Handle successful complete response
    if (data.success === true && Array.isArray(data.items)) {
      const completedFile = data.items.find((item: any) => item.path === upload.path);
      if (completedFile && upload.status === 'uploaded') {
        onSetFileState((prev) => ({
          ...prev,
          [upload.path]: {
            ...prev[upload.path],
            status: 'completed',
            progress: 100,
          },
        }));
      }
    }

    // Handle per-file errors
    if (Array.isArray(data.error_items)) {
      const fileError = data.error_items.find((e: any) => e.path === upload.path);
      if (fileError && (upload.status !== 'error' || upload.error?.message !== fileError.error)) {
        onSetFileState((prev) => ({
          ...prev,
          [upload.path]: {
            ...prev[upload.path],
            status: 'error',
            error: {
              message: fileError.error,
              details: fileError.details,
            },
          },
        }));
      }
    }

    // Handle general error
    if (data.error) {
      onError(data.error);
    }
  }, [fetcher.data, upload.path, upload.status, onSetFileState, onError]);

  const isPending = upload.status === 'staged' || upload.status === 'pending';

  // Track upload progress and handle status visibility
  useEffect(() => {
    if (upload.status !== 'completed') {
      // We've seen this upload in a non-completed state
      setHasSeenNonCompleted(true);
      setHideStatus(false);
    } else if (upload.status === 'completed' && hasSeenNonCompleted) {
      // Only show progress for completed uploads that we've seen go through the process
      const timer = setTimeout(() => {
        setHideStatus(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      // Completed upload that we haven't seen go through the process (page refresh)
      setHideStatus(true);
    }
  }, [upload.status, hasSeenNonCompleted]);

  function handleLabelChange(newLabel: string) {
    const error = validateLabel ? validateLabel(newLabel, upload.path) : null;
    setLabelError(error);
    // Only optimistically update if valid
    if (!error) {
      onSetFileState((prev) => ({
        ...prev,
        [upload.path]: {
          ...prev[upload.path],
          label: newLabel,
        },
      }));
    }
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative z-10 flex flex-col items-left gap-4 p-4 rounded-lg shadow-sm border w-full pointer-none transition-all duration-600 ease-in-ease-out',
        {
          'pb-3': showLabel,
          'opacity-50': removeFetcher.state !== 'idle',
          // Add error styling:
          'border-red-500 bg-red-50 dark:bg-red-950': upload.status === 'error',
          // Default styling when no error:
          'bg-stone-50 dark:bg-stone-700 dark:border-stone-600': upload.status !== 'error',
          // Add custom pulse animation for highlighting:
          'animate-pulse border-blue-500 bg-blue-50 dark:bg-blue-950': isHighlighted,
        },
      )}
    >
      <div className="grid justify-between grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1 md:justify-start">
        <FileIcon upload={upload} iconType={iconType} label={upload.name} />

        {showLabel && (
          <div className="flex items-center gap-1">
            {readonly ? (
              <span className="flex items-center min-w-0 font-mono text-xs text-stone-500">
                <span className="flex-shrink-0 mr-1">Label:</span>"
                <span className="overflow-hidden flex-1 text-blue-700 whitespace-nowrap max-w-[280px] sm:max-w-[200px] lg:max-w-[280px] text-ellipsis">
                  {upload.label || ''}
                </span>
                "
              </span>
            ) : (
              <InlineEditable
                ref={inlineEditableRef}
                intent="edit-label"
                defaultValue={upload.label || ''}
                size="compact"
                error={labelError || undefined}
                ariaLabel="Edit file label"
                className="inline-block w-full"
                textClassName="inline-flex"
                placeholder="Enter label"
                pattern="[a-zA-Z0-9 .,&\(\)_\-]*"
                renderDisplay={(value) => (
                  <div className="relative flex items-center min-w-0 overflow-hidden font-mono text-xs">
                    <span className="flex-shrink-0 mr-1">Label:</span>
                    <span className="overflow-hidden text-blue-700 whitespace-nowrap max-w-[280px] sm:max-w-[200px] lg:max-w-[280px] text-ellipsis">
                      {value}
                    </span>
                    <SimpleTooltip title="Edit label" side="right">
                      <Pencil
                        className="w-3.5 h-3.5 text-blue-400 cursor-pointer ml-1 flex-shrink-0"
                        onClick={() => inlineEditableRef.current?.startEdit?.()}
                      />
                    </SimpleTooltip>
                  </div>
                )}
                fetcher={undefined} // Use local fetcher for now
                onChange={handleLabelChange}
                extraFields={{ slot, path: upload.path }}
              />
            )}
          </div>
        )}
      </div>
      {!hideStatus && (
        <div className="flex flex-col mb-0 gap-[2px]">
          <ProgressBar status={upload.status} progress={upload.progress} isPending={isPending} />
          <StatusMessage status={upload.status} error={upload.error} isPending={isPending} />
        </div>
      )}
      {!readonly && (
        <RemoveButton
          slot={slot}
          upload={upload}
          onSetFileState={onSetFileState}
          onError={onError}
          fetcher={removeFetcher}
        />
      )}
    </div>
  );
}
