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

export type FileUpload = FileInfo & {
  bucket: string;
  signedUrl: string;
};

export interface WorkBody {
  id: string;
  cdn: string;
}

export interface SubmissionBody {
  work_version_id: string;
  kind: string;
}
