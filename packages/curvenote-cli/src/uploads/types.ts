import type { FileUploadResponse, SignedUploadInfo, UploadFileInfo } from '@curvenote/common';

export type { FileUploadResponse, SignedUploadInfo, UploadFileInfo };

export type FromTo = {
  from: string;
  to: string;
};

export type FileInfo = {
  from: string;
  to: string;
  md5: string;
  size: number;
  contentType: string;
};

export type SignedFileInfo = FileInfo & {
  signedUrl: string;
  /** Protocol-aware upload info. When present, determines upload strategy. */
  upload?: SignedUploadInfo;
};
