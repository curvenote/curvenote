import type { Response } from 'express';
import { getWorksApiBase, addFilesToWorkVersion, type WorkVersionFileEntry } from './works.js';
import { uploadSingleFileToCdn, type UploadResult } from './uploads.js';
import { createJobsHandler, type JobsHandler } from './jobs.js';
import { createSubmissionsHandler, type SubmissionsHandler } from './submissions.js';

/** Options when creating the SCMS client. */
export type SCMSClientOptions = {
  /** v1 API base URL (e.g. https://api.example.com/v1). Defaults to derived from jobUrl. */
  baseUrl?: string;
  /** When true, all SCMS HTTP calls (jobs, submissions, works, uploads) are skipped and only logged. */
  loggingOnlyMode?: boolean;
};

/**
 * Unified SCMS client: jobs, submissions, works, and uploads.
 * Use this in cloud runners to interact with the SCMS API without depending on @curvenote/cli.
 *
 * - jobs: update job status (completed, failed, running)
 * - submissions: put submission status (putStatus)
 * - works: get base URL, add files to work version metadata
 * - uploads: upload single file to CDN (stage → upload → commit)
 *
 * Use client.jobs.*, client.submissions.*, client.works.*, client.uploads.* only.
 */
export class SCMSClient {
  readonly jobUrl: string;
  readonly statusUrl: string;
  readonly handshake: string;
  readonly baseUrl: string;
  readonly loggingOnlyMode: boolean;

  readonly jobs: JobsHandler;
  readonly submissions: SubmissionsHandler;

  readonly works: {
    getBaseUrl: () => string;
    addFilesToWorkVersion: (
      workId: string,
      workVersionId: string,
      files: WorkVersionFileEntry[],
    ) => Promise<void>;
  };

  readonly uploads: {
    uploadSingleFileToCdn: (opts: {
      cdn: string;
      cdnKey: string;
      localPath: string;
      storagePath: string;
      resume?: boolean;
    }) => Promise<UploadResult>;
  };

  constructor(jobUrl: string, statusUrl: string, handshake: string, options?: SCMSClientOptions) {
    this.jobUrl = jobUrl;
    this.statusUrl = statusUrl;
    this.handshake = handshake;
    this.baseUrl = options?.baseUrl ?? getWorksApiBase({ jobUrl, statusUrl });
    this.loggingOnlyMode = options?.loggingOnlyMode ?? false;

    this.jobs = createJobsHandler(this.jobUrl, this.handshake, this.loggingOnlyMode);
    this.submissions = createSubmissionsHandler(
      this.statusUrl,
      this.handshake,
      this.loggingOnlyMode,
    );

    this.works = {
      getBaseUrl: () => this.baseUrl,
      addFilesToWorkVersion: (
        workId: string,
        workVersionId: string,
        files: WorkVersionFileEntry[],
      ) =>
        addFilesToWorkVersion(
          workId,
          workVersionId,
          files,
          this.handshake,
          this.baseUrl,
          fetch,
          this.loggingOnlyMode,
        ),
    };

    const getAuthHeaders = (): Promise<Record<string, string>> =>
      Promise.resolve(
        this.handshake
          ? { Authorization: `Bearer ${this.handshake}` }
          : ({} as Record<string, string>),
      );

    this.uploads = {
      uploadSingleFileToCdn: (opts) =>
        uploadSingleFileToCdn(this.baseUrl, getAuthHeaders, {
          ...opts,
          loggingOnlyMode: this.loggingOnlyMode,
        }),
    };
  }
}
