import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import type { DropzoneProps } from '../ui/dropzone.js';
import { Dropzone } from '../ui/dropzone.js';
import { toast } from 'sonner';
import type { UploadFileInfo } from '@curvenote/common';
import { getFileMD5Hash, handleFileUpload } from './utils.js';
import { UploadIcon } from 'lucide-react';

type FileStatus =
  | 'pending'
  | 'staging'
  | 'uploading'
  | 'uploaded'
  | 'completing'
  | 'completed'
  | 'error';

interface UploadState {
  file: File | null;
  status: FileStatus;
  progress: number;
  error?: string;
  path?: string;
}

export const FILE_UPLOAD_INTENTS = {
  uploadStage: 'upload.stage' as const,
  uploadComplete: 'upload.complete' as const,
};

interface FileDropzoneProps {
  folder: string;
  slot: string;
  readonly?: boolean;
  onUploadComplete?: (uploadedPath: string) => void;
  maxSize?: number;
  accept?: DropzoneProps['accept'];
  className?: string;
  height?: string;
}

export function FileDropzone({
  folder,
  slot,
  readonly = false,
  onUploadComplete,
  maxSize = 1 * 1024 * 1024,
  accept = { 'image/*': [] },
  className,
  height = '120px',
}: FileDropzoneProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    status: 'pending',
    progress: 0,
  });
  const [generalError, setGeneralError] = useState<string | undefined>(undefined);
  const fetcher = useFetcher();

  // Handle file selection
  const handleDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setGeneralError(undefined);
    setUploadState({
      file,
      status: 'staging',
      progress: 0,
    });

    try {
      // Calculate MD5 hash
      const md5 = await getFileMD5Hash(file);
      const path = `${folder}/${md5}/${file.name}`;

      const fileInfo: UploadFileInfo = {
        path,
        md5,
        size: file.size,
        content_type: file.type,
      };

      // Stage the file
      const stageFormData = new FormData();
      stageFormData.append('files', JSON.stringify(fileInfo));
      stageFormData.append('slot', slot);
      stageFormData.append('intent', FILE_UPLOAD_INTENTS.uploadStage);

      fetcher.submit(stageFormData, { method: 'POST' });

      setUploadState((prev) => ({
        ...prev,
        status: 'staging',
        progress: 10,
        path,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
      setUploadState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      toast.error(errorMessage);
    }
  };

  // Handle fetcher responses
  useEffect(() => {
    if (!fetcher.data) return;
    const data = fetcher.data as any;

    if (uploadState.status === 'completed') return;

    // Handle general errors
    if (data.error) {
      const errorMessage = data.error.message || 'Upload failed';
      setUploadState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      toast.error(errorMessage);
      return;
    }

    // Handle per-file errors
    if (data.error_items && data.error_items.length > 0) {
      const errorItem = data.error_items[0];
      const errorMessage = errorItem.details?.message || errorItem.error || 'Upload failed';
      setUploadState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      toast.error(errorMessage);
      return;
    }

    // Handle staging response - start upload
    if (data.upload_items && uploadState.status === 'staging') {
      const uploadItem = data.upload_items[0];
      if (uploadItem && uploadState.file && uploadState.path) {
        setUploadState((prev) => ({
          ...prev,
          status: 'uploading',
          progress: 20,
        }));
        handleFileUpload(uploadState.file, uploadItem.signed_url, uploadState.path, (progress) => {
          setUploadState((prev) => ({
            ...prev,
            progress: 20 + progress * 0.65,
          }));
        })
          .then(() => {
            setUploadState((prev) => ({
              ...prev,
              status: 'completing',
              progress: 90,
            }));

            // Complete the upload
            const completeFormData = new FormData();
            const fileInfo: UploadFileInfo = {
              path: uploadState.path!,
              md5: uploadItem.md5,
              size: uploadState.file!.size,
              content_type: uploadState.file!.type,
            };
            completeFormData.append('completedFiles', JSON.stringify([fileInfo]));
            completeFormData.append('slot', slot);
            completeFormData.append('intent', FILE_UPLOAD_INTENTS.uploadComplete);

            fetcher.submit(completeFormData, { method: 'POST' });
          })
          .catch((error) => {
            setUploadState((prev) => ({
              ...prev,
              status: 'error',
              error: error.message,
            }));
            toast.error(error.message);
          });
      }
    }

    // Handle cached items (file already exists)
    if (data.cached_items && data.cached_items.length > 0 && uploadState.status === 'staging') {
      const cachedItem = data.cached_items[0];
      setUploadState((prev) => ({
        ...prev,
        status: 'completing',
        progress: 90,
      }));

      // Complete the upload for cached file
      const completeFormData = new FormData();
      const fileInfo: UploadFileInfo = {
        path: uploadState.path!,
        md5: cachedItem.md5,
        size: uploadState.file!.size,
        content_type: uploadState.file!.type,
      };
      completeFormData.append('completedFiles', JSON.stringify([fileInfo]));
      completeFormData.append('slot', slot);
      completeFormData.append('intent', FILE_UPLOAD_INTENTS.uploadComplete);

      fetcher.submit(completeFormData, { method: 'POST' });
    }

    // Handle completion
    if (data.success && uploadState.status === 'completing') {
      setUploadState((prev) => ({
        ...prev,
        status: 'completing',
        progress: 95,
      }));

      // Call the onUploadComplete callback if provided
      if (onUploadComplete && uploadState.path) {
        onUploadComplete(uploadState.path);
      }

      setUploadState((prev) => ({
        ...prev,
        status: 'completed',
        progress: 100,
      }));
      toast.success('File uploaded successfully');
    }
  }, [fetcher.data, uploadState.status, uploadState.file, uploadState.path, onUploadComplete]);

  // UI state
  const showProgress = ['staging', 'uploading', 'completing'].includes(uploadState.status);
  const showCompleted = uploadState.status === 'completed';
  const errorMessage = generalError || uploadState.error;

  return (
    <Dropzone
      src={undefined}
      onDrop={handleDrop}
      maxFiles={1}
      maxSize={maxSize}
      accept={accept}
      disabled={readonly}
      className={className}
      onError={(error) => {
        const message = error.message || 'Failed to upload file';
        setGeneralError(message);
        toast.error(message);
      }}
    >
      {/* Fixed-size container to prevent resizing */}
      <div
        className="relative flex flex-col items-center justify-center w-full"
        style={{ minHeight: height, maxHeight: height }}
      >
        {!showProgress && (
          <>
            <UploadIcon className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click or drag image to upload</p>
          </>
        )}
        {!errorMessage && !showCompleted && !showProgress && (
          <p className="mt-1 text-xs text-muted-foreground">
            Max size: {Math.round(maxSize / (1024 * 1024))}MB
          </p>
        )}

        {errorMessage && (
          <div className="px-3 py-2 text-xs text-red-600 rounded-md bg-red-50 dark:bg-red-900/20 dark:text-red-400 max-w-[90%] pointer-events-auto">
            {errorMessage}
          </div>
        )}

        {showCompleted && uploadState.file && !errorMessage && (
          <div className="px-3 py-2 text-xs text-green-600 rounded-md bg-green-50 dark:bg-green-900/20 dark:text-green-400 max-w-[90%] pointer-events-auto">
            ✓ Uploaded successfully
          </div>
        )}

        {showProgress && uploadState.file && !errorMessage && (
          <div className="w-[90%] px-3 py-2 rounded-md bg-white/95 dark:bg-slate-950/95 pointer-events-auto">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex-1 mr-2 font-medium truncate w-[60%]">
                  {uploadState.file.name}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {Math.round(uploadState.progress)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full dark:bg-gray-700">
                <div
                  className="h-1.5 transition-all duration-300 bg-blue-600 rounded-full"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
        {/* </div> */}
      </div>
    </Dropzone>
  );
}
