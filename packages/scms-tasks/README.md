# @curvenote/scms-tasks

SCMS tasks library for cloud runners: job client and shared helpers used by Cloud Run services (e.g. converter, PMC FTP).

## Contents

- **SCMSJobClient** – client for the SCMS job service (status updates, handshake)
- **removeFolder**, **pubsubError** – utilities for Pub/Sub handlers and temp cleanup
- **scripts/pubsub.sh** – script to set up GCP Pub/Sub (topic, push subscription, service account) for a Cloud Run service that uses this library. See script header and `scripts/.env.sample` for required env vars and prerequisites.

This package is not published to the public registry. From the repo root, the workspace resolves it when you run `npm install`.

## Usage

```ts
import { SCMSJobClient, removeFolder, pubsubError } from '@curvenote/scms-tasks';
```

## Build

```bash
npm run build
```
