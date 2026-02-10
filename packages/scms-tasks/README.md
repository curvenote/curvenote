# @curvenote/scms-tasks

SCMS tasks library for cloud runners: unified SCMS client and shared helpers used by Cloud Run services (e.g. converter, PMC FTP). A runner that depends only on `@curvenote/scms-tasks` can perform job updates, submission status, works API (work version metadata), and uploads without depending on `@curvenote/cli`.

## Contents

- **SCMSClient** – unified client with a clear structure:
  - **jobs** – job status (completed, failed, running), PATCH job URL
  - **submissions** – put submission status (PUT status URL)
  - **works** – get v1 base URL, update work version metadata (PATCH)
  - **uploads** – upload single file to CDN (stage → resumable upload → commit)
- **createJobsHandler**, **createSubmissionsHandler** – factories used by SCMSClient (exported for testing or custom wiring)
- **getWorksApiBase**, **updateWorkVersionMetadata** – works API helpers (also exposed via `client.works`)
- **uploadSingleFileToCdn**, **stageUploadRequest**, **commitUploads** – upload API (also exposed via `client.uploads`)
- **removeFolder**, **pubsubError** – utilities for Pub/Sub handlers and temp cleanup
- **withPubSubHandler** – wraps POST handler with validation, temp folder, and **SCMSClient** in context
- **scripts/pubsub.sh** – script to set up GCP Pub/Sub. See script header and `scripts/.env.sample`.

This package is not published to the public registry. From the repo root, the workspace resolves it when you run `npm install`.

## Usage

```ts
import {
  SCMSClient,
  withPubSubHandler,
  getWorksApiBase,
  removeFolder,
  pubsubError,
} from '@curvenote/scms-tasks';

// In a Pub/Sub handler (withPubSubHandler creates SCMSClient from attributes):
const handler = withPubSubHandler<MyPayload>(async (ctx) => {
  const { client, payload, tmpFolder, res } = ctx;
  await client.jobs.running(res, 'Starting...');
  const result = await client.uploads.uploadSingleFileToCdn({ cdn, cdnKey, localPath, storagePath });
  await client.works.updateWorkVersionMetadata(workId, workVersionId, metadata);
  await client.jobs.completed(res, 'Done', { exportPath: result.path });
});

// Or create SCMSClient directly:
const baseUrl = getWorksApiBase({ jobUrl, statusUrl });
const client = new SCMSClient(jobUrl, statusUrl, handshake, { baseUrl, loggingOnlyMode: false });
await client.jobs.completed(res, 'Done', {});
await client.works.updateWorkVersionMetadata(workId, workVersionId, metadata);
await client.uploads.uploadSingleFileToCdn({ cdn, cdnKey, localPath, storagePath });
```

## Build

```bash
npm run build
```
