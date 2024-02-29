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
};

export interface UploadFileInfo {
  path: string;
  content_type: string;
  md5: string;
  size: number;
}

export interface FileUploadResponse extends UploadFileInfo {
  signed_url: string;
}
