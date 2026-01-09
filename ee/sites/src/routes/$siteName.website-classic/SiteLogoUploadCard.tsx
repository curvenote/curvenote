import { useState, useEffect } from 'react';
import { primitives, ui, cn, getFileMD5Hash, handleFileUpload } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';
import type { UploadFileInfo } from '@curvenote/common';

interface SiteLogoUploadCardProps {
  siteName: string;
  currentLogoUrl?: string;
  className?: string;
  readonly?: boolean;
}

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

export function SiteLogoUploadCard({
  siteName,
  currentLogoUrl,
  className,
  readonly = false,
}: SiteLogoUploadCardProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    status: 'pending',
    progress: 0,
  });
  const [generalError, setGeneralError] = useState<string | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(currentLogoUrl);
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
      const path = `static/site/${siteName}/${file.name}`;

      const fileInfo: UploadFileInfo = {
        path,
        md5,
        size: file.size,
        content_type: file.type,
      };

      // Stage the file
      const stageFormData = new FormData();
      stageFormData.append('files', JSON.stringify(fileInfo));
      stageFormData.append('slot', 'logo');
      stageFormData.append('intent', 'upload.stage');

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

    if (data.logoUrl && data.logoUrl !== logoUrl) {
      setLogoUrl(data.logoUrl);
    }

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
            completeFormData.append('slot', 'logo');
            completeFormData.append('intent', 'upload.complete');

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
      completeFormData.append('slot', 'logo');
      completeFormData.append('intent', 'upload.complete');

      fetcher.submit(completeFormData, { method: 'POST' });
    }

    // Handle completion
    if (data.success && uploadState.status === 'completing') {
      setUploadState((prev) => ({
        ...prev,
        status: 'completing',
        progress: 95,
      }));
      const setLogoFormData = new FormData();
      setLogoFormData.append('logoPath', uploadState.path!);
      setLogoFormData.append('intent', 'logo.update');

      fetcher.submit(setLogoFormData, { method: 'POST' });
      setUploadState((prev) => ({
        ...prev,
        status: 'completed',
        progress: 100,
      }));
      toast.success('Logo uploaded successfully');
    }
  }, [fetcher.data, uploadState.status, uploadState.file, uploadState.path]);

  const showDropzone = uploadState.status === 'pending' || uploadState.status === 'error';
  const showProgress = ['staging', 'uploading', 'completing'].includes(uploadState.status);
  const showCompleted = uploadState.status === 'completed';

  return (
    <primitives.Card lift className={cn('px-6 py-4 space-y-4', className)}>
      <div>
        <h2>Site Logo</h2>
        <p className="text-sm font-light">Upload a logo image for your site.</p>
      </div>

      {generalError && (
        <div className="p-3 text-sm text-red-600 rounded-md bg-red-50 dark:bg-red-900/20 dark:text-red-400">
          {generalError}
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {showDropzone && (
            <ui.Dropzone
              src={undefined}
              onDrop={handleDrop}
              maxFiles={1}
              maxSize={1 * 1024 * 1024}
              accept={{ 'image/*': [] }}
              disabled={readonly}
              onError={(error) => {
                const message = error.message || 'Failed to upload file';
                setGeneralError(message);
                toast.error(message);
              }}
            >
              <ui.DropzoneEmptyState />
            </ui.Dropzone>
          )}

          {uploadState.status === 'error' && uploadState.error && (
            <div className="p-3 text-sm text-red-600 rounded-md bg-red-50 dark:bg-red-900/20 dark:text-red-400">
              {uploadState.error}
            </div>
          )}

          {showProgress && uploadState.file && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{uploadState.file.name}</span>
                <span className="text-muted-foreground">{Math.round(uploadState.progress)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full dark:bg-gray-700">
                <div
                  className="h-2 transition-all duration-300 bg-blue-600 rounded-full"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            </div>
          )}

          {showCompleted && uploadState.file && (
            <div className="p-3 text-sm text-green-600 rounded-md bg-green-50 dark:bg-green-900/20 dark:text-green-400">
              ✓ {uploadState.file.name} uploaded successfully
            </div>
          )}
        </div>

        {currentLogoUrl && (
          <div className="flex-shrink-0 space-y-2">
            <p className="text-sm font-medium">Current Logo:</p>
            <img
              src={currentLogoUrl}
              alt="Current site logo"
              className="object-contain border rounded max-w-[240px] max-h-32"
            />
          </div>
        )}
      </div>
    </primitives.Card>
  );
}
