import md5 from 'md5';
import type { StageResponse } from './types.js';
import type { UploadStagingDTO } from '@curvenote/common';
import type { FetcherWithComponents } from 'react-router';

/**
 * Generates a unique file path for a given work and slot
 *
 * @param cdnKey - The cdnKey to target for this file
 * @param slug - The slot identifier used in the path e.g. might be an extension name or a file upload slot
 * @param fileName - The original file name
 * @returns A unique path for the file
 */
export function getFilePath(cdnKey: string, slug: string, fileName: string): string {
  return `${cdnKey}/${slug}/${fileName}`;
}

/**
 * Submits completed files to the server
 * @param fetcher - The fetcher to use
 * @param slot - The slot to use
 * @param files - The files to submit
 */
export function submitCompletedFiles(
  fetcher: FetcherWithComponents<any>,
  slot: string,
  files: { path: string; content_type: string; size: number; md5: string }[],
) {
  const formData = new FormData();
  formData.append('intent', 'complete');
  formData.append('slot', slot);
  formData.append('completedFiles', JSON.stringify(files));
  fetcher.submit(formData, { method: 'POST' });
}

/**
 * Submits a completed file to the server
 * @param fetcher - The fetcher to use
 * @param slot - The slot to use
 * @param file - The file to submit
 */
export function submitCompletedFile(
  fetcher: FetcherWithComponents<any>,
  slot: string,
  file: {
    path: string;
    content_type: string;
    size: number;
    md5: string;
    label?: string;
  },
) {
  const formData = new FormData();
  formData.append('intent', 'complete');
  formData.append('slot', slot);
  formData.append('completedFiles', JSON.stringify([file]));
  fetcher.submit(formData, { method: 'POST' });
}

export async function getFileMD5Hash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = md5(new Uint8Array(buffer));
  return hash;
}

/**
 * Initializes an upload session with the provided signed URL
 * @param signedUrl - The signed URL for the upload
 * @param fileType - The MIME type of the file
 * @returns The session URL for the upload
 */
async function initializeUploadSession(signedUrl: string, fileType: string): Promise<string> {
  const initResponse = await fetch(signedUrl, {
    method: 'POST',
    headers: {
      'Content-Type': fileType,
      'x-goog-resumable': 'start',
    },
  });

  if (!initResponse.ok) {
    throw new Error(`Upload initialization failed with status ${initResponse.status}`);
  }

  const sessionUrl = initResponse.headers.get('Location');
  if (!sessionUrl) {
    throw new Error('Upload failed: no session URL');
  }

  return sessionUrl;
}

/**
 * Performs the actual file upload
 * @param sessionUrl - The session URL for the upload
 * @param file - The file to upload
 * @param onProgress - Callback to update upload progress
 * @returns The upload response
 */
async function performFileUpload(
  sessionUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        // Cap progress at 95% during file upload
        const rawProgress = (event.loaded * 100) / event.total;
        // the file upload gets us to 955 whilst the complete action gets the last 5%
        const cappedProgress = Math.min(95, Math.round(rawProgress));
        onProgress(cappedProgress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(
          new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
          }),
        );
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.send(file);
  });
}

/**
 * Handles the complete file upload process
 * @param file - The file to upload
 * @param signedUrl - The signed URL for the upload
 * @param filePath - The path where the file will be stored
 * @param onProgress - Callback to update upload progress
 * @returns Promise that resolves with the upload response
 */
export async function handleFileUpload(
  file: File,
  signedUrl: string,
  filePath: string,
  onProgress: (progress: number) => void,
): Promise<Response> {
  // Initialize upload session
  const sessionUrl = await initializeUploadSession(signedUrl, file.type);

  // Set initial progress to 0
  onProgress(0);

  // Perform the upload
  const uploadRes = await performFileUpload(sessionUrl, file, onProgress);

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}`);
  }

  // Keep progress at 95% until complete action is done
  onProgress(95);
  return uploadRes;
}

export function isGeneralError(response: StageResponse): response is StageResponse {
  if ('error' in response) {
    return response.error?.type === 'general';
  }
  return false;
}

export function isUploadStagingDTO(response: StageResponse): response is UploadStagingDTO & {
  error_items?: Array<{
    path: string;
    error: string;
    details?: Record<string, any>;
  }>;
} {
  return 'cached_items' in response || 'upload_items' in response;
}
