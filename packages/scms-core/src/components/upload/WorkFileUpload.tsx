import { useState, useEffect, useMemo } from 'react';
import { Card } from '../primitives/index.js';
import type { FetcherWithComponents } from 'react-router';
import { useFetcher } from 'react-router';
import { cn } from '../../utils/cn.js';
import { WorkFileCard } from './WorkFileCard.js';
import type { FileState, FileUpload, StageResponse } from './types.js';
import { getFileMD5Hash, getFilePath, handleFileUpload, isUploadStagingDTO } from './utils.js';
import { generateUniqueFileLabel } from '../../backend/uploads/utils.js';
import type { UploadFileInfo } from '@curvenote/common';
import type { FileMetadataSection, FileUploadConfig } from '../../backend/uploads/schema.js';
import type { GeneralError } from '../../backend/types.js';

// Global state for highlighted files (simple implementation)
const highlightedFiles: Set<string> = new Set();
const highlightListeners: Set<() => void> = new Set();

function useHighlightedFiles() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    highlightListeners.add(listener);
    return () => {
      highlightListeners.delete(listener);
    };
  }, []);

  const highlightFile = (filePath: string, duration: number = 3000) => {
    highlightedFiles.add(filePath);
    highlightListeners.forEach((listener) => {
      listener();
    });

    // Auto-remove highlight after duration
    setTimeout(() => {
      highlightedFiles.delete(filePath);
      highlightListeners.forEach((listener) => {
        listener();
      });
    }, duration);
  };

  const isHighlighted = (filePath: string) => highlightedFiles.has(filePath);

  return { highlightFile, isHighlighted };
}

/**
 * Props for the FileUpload component
 * @param cdnKey - The CDN key to target for this upload
 * @param config - The upload configuration for this slot (contains slot, label, description, etc.)
 * @param slug - The slug identifier used in the file path, falls back to the slot
 * @param loadedFileMetadata - Initial file metadata for the upload section, will be filtered by slot
 * @param readonly - Whether the component is in read-only mode
 * @param icon - Icon type to display for files in this section
 * @param alert - Optional React node for custom alerts/messages
 */
interface WorkFileUploadProps {
  cdnKey: string;
  config: FileUploadConfig;
  slug?: string;
  loadedFileMetadata?: FileMetadataSection | null;
  readonly?: boolean;
  icon?: 'file' | 'image' | 'video' | 'table';
  alert?: React.ReactNode;
}

// Helper to detect upload complete DTO
function isUploadCompleteDTO(data: any): data is { error_items?: any[] } {
  return data && (Array.isArray(data.items) || Array.isArray(data.error_items));
}

// Centralized function to process error_items
function processErrorItems(
  error_items: any[],
  setFileState: React.Dispatch<React.SetStateAction<FileState>>,
) {
  setFileState((prev: FileState) => {
    const newState = { ...prev };
    error_items.forEach(({ path, error, details }) => {
      if (newState[path]) {
        // For duplicate files, remove them from the UI entirely
        if (error === 'duplicate_file_content' || error === 'duplicate_file_name') {
          console.log(`Removing duplicate file: ${path} - ${error}`, details);
          delete newState[path];
        } else {
          // For other errors, mark as error but keep in UI
          newState[path] = {
            ...newState[path],
            status: 'error',
            error: {
              message: error,
              details,
            },
          };
        }
      }
    });
    return newState;
  });
}

export function WorkFileUpload({
  cdnKey,
  config,
  slug,
  loadedFileMetadata,
  readonly = false,
  icon = 'file',
  alert,
}: WorkFileUploadProps) {
  // Extract config values
  const {
    slot,
    label,
    description,
    optional = false,
    multiple,
    maxFiles,
    accept,
    hideFileCount = false,
  } = config;
  // Initialize state from existing files in metadata
  const loadedFileState = useMemo(() => {
    // Get existing files from the work's metadata
    const existingFiles = Object.values(loadedFileMetadata?.files ?? {}).filter(
      (file): file is FileMetadataSection['files'][string] => file.slot === slot,
    );

    return existingFiles.reduce<FileState>((acc, file) => {
      acc[file.path] = {
        name: file.name,
        size: file.size,
        type: file.type,
        path: file.path,
        md5: file.md5,
        status: 'completed',
        progress: 100,
        // @ts-expect-error: signedUrl is added by backend, not in base type
        signedUrl: file.signedUrl,
        label: file.label,
        order: file.order,
        uploadDate: file.uploadDate,
      };
      return acc;
    }, {});
  }, [loadedFileMetadata]);

  // State management
  const [fileState, setFileState] = useState<FileState>(loadedFileState);
  const { highlightFile, isHighlighted } = useHighlightedFiles();

  useEffect(() => {
    setFileState((prev) => ({ ...prev, ...loadedFileState }));
  }, [loadedFileState]);

  const [generalError, setGeneralError] = useState<GeneralError | undefined>(undefined);
  const fetcher = useFetcher<StageResponse>();

  // Check if we've reached the maximum number of files
  const currentFileCount = Object.keys(fileState).length;
  const isMaxFilesReached = maxFiles !== undefined && currentFileCount >= maxFiles;

  useEffect(() => {
    if (!fetcher.data) return;

    // Handle errors in the response (staging or complete)
    if (isUploadStagingDTO(fetcher.data) && (fetcher.data as any)?.error_items) {
      processErrorItems((fetcher.data as any).error_items, setFileState);
    }
    if (isUploadCompleteDTO(fetcher.data) && (fetcher.data as any)?.error_items) {
      processErrorItems((fetcher.data as any).error_items, setFileState);
    }

    // Handle successful staging response
    if (isUploadStagingDTO(fetcher.data)) {
      const stagingDto = fetcher.data;

      if (stagingDto.cached_items.length > 0) {
        stagingDto.cached_items.forEach((cachedFile) => {
          setFileState((prev) => ({
            ...prev,
            [cachedFile.path]: {
              ...prev[cachedFile.path],
              status: 'uploaded',
              progress: 95,
            },
          }));
        });
      }

      if (stagingDto.upload_items.length > 0) {
        stagingDto.upload_items.forEach(async (upload) => {
          const fileInfo = fileState[upload.path];
          const file = fileInfo?.file;
          if (!file) {
            setFileState((prev) => ({
              ...prev,
              [upload.path]: {
                ...prev[upload.path],
                status: 'error',
                progress: 100,
                error: {
                  message: 'Upload failed (no file)',
                },
              },
            }));
            return;
          }

          setFileState((prev) => ({
            ...prev,
            [upload.path]: {
              ...prev[upload.path],
              signedUrl: upload.signed_url,
              status: 'staged',
              progress: 0,
            },
          }));

          setTimeout(() => {
            handleFileUpload(file, upload.signed_url, upload.path, (progress) => {
              setFileState((prev) => ({
                ...prev,
                [upload.path]: {
                  ...prev[upload.path],
                  progress,
                },
              }));
            })
              .then(() => {
                setFileState((prev) => ({
                  ...prev,
                  [upload.path]: {
                    ...prev[upload.path],
                    progress: 100,
                    status: 'uploaded',
                    file: undefined,
                    signedUrl: undefined,
                  },
                }));
              })
              .catch((error) => {
                setFileState((prev) => ({
                  ...prev,
                  [upload.path]: {
                    ...prev[upload.path],
                    status: 'error',
                    progress: 100,
                    error: {
                      message: error instanceof Error ? error.message : 'Upload failed',
                    },
                  },
                }));
              });
          }, 100);
        });
      }
    }
  }, [fetcher.data]);

  /**
   * Handles file selection from the input element
   * - Creates file info objects
   * - Updates state with new files
   * - Submits files for staging
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const remainingSlots = maxFiles ? maxFiles - currentFileCount : files.length;

    // If we have a maxFiles limit, only take the first N files that fit
    const filesToProcess = maxFiles ? files.slice(0, remainingSlots) : files;

    // Client-side duplicate detection across ALL slots using MD5 hash
    const allExistingFiles = Object.values(loadedFileMetadata?.files ?? {});

    // First, calculate hashes for all files in the batch
    const filesWithHashes = await Promise.all(
      filesToProcess.map(async (file) => {
        const fileHash = await getFileMD5Hash(file);
        return { file, hash: fileHash, name: file.name };
      }),
    );

    // Check for duplicates within the batch itself
    const batchDuplicates = new Set<string>();
    const seenHashes = new Set<string>();
    const seenNames = new Set<string>();

    filesWithHashes.forEach(({ hash, name }) => {
      // Check for duplicate hash within the batch
      if (seenHashes.has(hash)) {
        console.log(`Skipping duplicate file within batch (same content): ${name}`);
        batchDuplicates.add(name);
        return;
      }

      // Check for duplicate name within the batch
      if (seenNames.has(name)) {
        console.log(`Skipping duplicate file within batch (same name): ${name}`);
        batchDuplicates.add(name);
        return;
      }

      seenHashes.add(hash);
      seenNames.add(name);
    });

    // Now check against existing files
    const nonDuplicateFiles = filesWithHashes
      .filter(({ hash, name }) => {
        // Skip if it's a batch duplicate
        if (batchDuplicates.has(name)) {
          return false;
        }

        // Check for duplicate by MD5 hash (same file content) across all slots
        const duplicateByHash = allExistingFiles.find((existingFile) => existingFile.md5 === hash);
        if (duplicateByHash) {
          console.log(
            `Skipping duplicate file across all slots (same content): ${name} (matches ${duplicateByHash.name})`,
          );

          // Find the existing file and highlight it
          highlightFile(duplicateByHash.path, 2000); // Highlight for 2 seconds

          return false; // Mark as duplicate
        }

        // Check for duplicate by filename across all slots (fallback)
        const duplicateByName = allExistingFiles.find((existingFile) => existingFile.name === name);
        if (duplicateByName) {
          console.log(`Skipping duplicate file across all slots (same name): ${name}`);

          // Find the existing file and highlight it
          highlightFile(duplicateByName.path, 2000); // Highlight for 2 seconds

          return false; // Mark as duplicate
        }

        return true; // Not a duplicate
      })
      .map(({ file }) => file);

    if (nonDuplicateFiles.length === 0) {
      // All files were duplicates, don't proceed
      e.target.value = '';
      return;
    }

    // Show notification if some files were skipped
    if (nonDuplicateFiles.length < filesToProcess.length) {
      const skippedCount = filesToProcess.length - nonDuplicateFiles.length;
      const message =
        skippedCount === 1
          ? '1 duplicate file was skipped (already exists in another slot or within selection)'
          : `${skippedCount} duplicate files were skipped (already exist in other slots or within selection)`;
      console.log(message);
      // TODO: Add proper toast notification here if needed
    }

    const filesToUpload: FileUpload[] = await Promise.all(
      nonDuplicateFiles.map(async (file, index) => {
        const path = getFilePath(cdnKey, slug ?? slot, file.name);
        const hash = await getFileMD5Hash(file);

        // Only generate optimistic label if labels are required for this slot
        let optimisticLabel: string | undefined;
        if (config.requireLabel) {
          const existingLabels = new Set(
            Object.values(fileState)
              .map((f) => f.label)
              .filter((labelValue): labelValue is string => Boolean(labelValue)),
          );
          optimisticLabel = generateUniqueFileLabel(file.name, existingLabels);
        }

        // Calculate optimistic order number to place new files at the end
        const existingFilesWithOrder = Object.values(fileState).filter(
          (f) => f.order !== undefined,
        );
        const maxOrder =
          existingFilesWithOrder.length > 0
            ? Math.max(...existingFilesWithOrder.map((f) => f.order!))
            : 0;
        const optimisticOrder = maxOrder + 1 + index;

        return {
          path,
          md5: hash,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending',
          progress: 0,
          file,
          label: optimisticLabel,
          order: optimisticOrder,
          uploadDate: new Date().toISOString(),
        };
      }),
    );

    // Reset the merged general error
    setGeneralError(undefined);

    // Set initial status to 'selected' for all new files
    setFileState((prev) => {
      const newState = { ...prev };
      filesToUpload.forEach((item) => {
        newState[item.path] = item;
      });
      return newState;
    });

    // Submit files for staging
    const formData = new FormData();
    formData.append('intent', 'stage');
    formData.append('slot', slot);
    filesToUpload.forEach((file) => {
      const dto: UploadFileInfo = {
        path: file.path,
        content_type: file.type,
        md5: file.md5,
        size: file.size,
      };
      formData.append('files', JSON.stringify(dto));
    });

    fetcher.submit(formData, { method: 'POST' });

    // Reset the input value after processing
    e.target.value = '';
  };

  // Get all files to display from fileState
  const displayFiles = Object.values(fileState).sort((a, b) => {
    // Sort by order field if available, otherwise by uploadDate
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Fallback to uploadDate if order is not available (backward compatibility)
    const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
    const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
    return dateA - dateB;
  });

  const error = fetcher.data?.error || generalError;
  const mergedFetcher = {
    data: {
      ...fetcher.data,
      error,
    },
  };

  const showFileCount = !hideFileCount && !isMaxFilesReached && maxFiles !== undefined;

  function validateFileLabel(newLabel: string, currentFilePath?: string): string | null {
    if (!config.requireLabel) return null;
    if (!newLabel.trim()) return 'Label cannot be empty.';
    if (!/^[a-zA-Z0-9 .,&()_-]+$/.test(newLabel))
      return 'Invalid characters: only letters, numbers, spaces, . , & ( ) - _ allowed.';

    // Build a list of labels as if the new label is already set for the current file
    const slotLabels = Object.entries(fileState)
      .map(([path, f]) => (path === currentFilePath ? newLabel : f.label))
      .filter(Boolean) as string[];

    // Count how many times this label appears in the current slot
    const labelCount = slotLabels.filter((l) => l === newLabel).length;
    if (labelCount > 1) return 'Each label must be unique within this slot.';

    return null;
  }

  return (
    <Card
      validateUsing={mergedFetcher as FetcherWithComponents<any>}
      className={cn(
        'relative border transition-colors border-stone-300 bg-stone-100 dark:border-stone-500',
        {
          'hover:border-stone-400 dark:hover:border-stone-400': !readonly,
        },
        'outline-primary focus-within:outline-2 outline-offset-2',
      )}
    >
      {!readonly && (
        <input
          type="file"
          multiple={multiple}
          accept={accept}
          className={cn('absolute inset-0 z-0 w-full h-full opacity-0 select-none', {
            'cursor-pointer': !isMaxFilesReached,
          })}
          onChange={handleFileSelect}
          disabled={isMaxFilesReached}
          title={description}
        />
      )}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-700 dark:text-stone-300">
              {label}
              {optional && !readonly && <span className="text-stone-400"> (optional)</span>}
            </span>
            {showFileCount && (
              <span className="text-xs text-stone-400">
                ({currentFileCount}/{maxFiles} files)
              </span>
            )}
          </div>
          {!readonly && (
            <p className="text-sm text-stone-500">
              {isMaxFilesReached ? (
                <span className="text-stone-400">Maximum files reached</span>
              ) : (
                <>
                  <span className="text-blue-500 underline cursor-pointer">
                    Browse your computer
                  </span>
                  <span className="text-stone-400">{' or drag and drop your file(s) here'}</span>
                </>
              )}
            </p>
          )}
        </div>

        {displayFiles.length > 0 && (
          <div className="pt-4 border-t border-stone-300 dark:border-stone-500">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {displayFiles.map((upload) => (
                <WorkFileCard
                  key={upload.path}
                  slot={slot}
                  upload={upload}
                  onSetFileState={setFileState}
                  onError={(e) => setGeneralError(e)}
                  readonly={readonly}
                  iconType={icon}
                  validateLabel={validateFileLabel}
                  showLabel={config.requireLabel}
                  isHighlighted={isHighlighted(upload.path)}
                />
              ))}
            </div>
          </div>
        )}

        {alert && <div className="">{alert}</div>}
      </div>
    </Card>
  );
}
