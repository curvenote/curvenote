# Jobs: handlers

**Job handlers** run when the queue consumer delivers a job message—via **`api/job-queue-consumer.ts`** (Vercel queue push) on preview/production or **`POST /v1/jobs/mock-push`** (mock provider) in development. Each handler is keyed by **`job_type`** and receives a `CreateJob`-shaped payload plus request context.

A handler may:

- **Do the work inline** in the same process (synchronous steps or `async` work that finishes before the response), or
- **Delegate to an external pipeline**—for example by publishing to Pub/Sub so a **Cloud Run** worker runs the job; see [`../processing`](../processing) for helpers that enqueue those messages.

So “async” here means either **awaiting work in the handler** or **handing off** to another system and returning after the job row / side effects are in the right state.

[`index.ts`](./index.ts) registers **core** handlers (`CHECK`, `PUBLISH`, `UNPUBLISH`, `CONVERTER_TASK`, etc.) and merges in **extension** handlers from the app. **`enqueueAndDispatchJob`** inserts a QUEUED row and publishes to the queue; **`processJobMessage`** resolves handlers via `getHandlers` and runs the handler for that `job_type`.

## Adding a new job type

1. **Implement a handler** in this folder (e.g. `my-job.server.ts`) with the [`JobHandler`](./index.ts) shape: `(ctx, data, storageBackend?) => …`.
2. **Register it** in [`index.ts`](./index.ts) `coreHandlers` under the exact `job_type` string you will send on the API.

**Core (platform) types** also need:

1. **`KnownJobTypes`** (or equivalent string constant) in **`@curvenote/scms-core`** if you use the shared enum.
2. **Allow-list for `POST /v1/jobs`** — the `job_type` must appear in the **core** list inside `getJobTypes` in the SCMS app route `platform/scms/app/routes/api/v1.jobs.tsx` (otherwise Zod will reject the body).
3. **Optional** wiring in [`loaders/jobs/invoke.server.ts`](../../loaders/jobs/invoke.server.ts) (e.g. storage backend, default `activity_type`) only if this job type needs the same special cases as existing core jobs.

**Extension** job types:

1. Return a **`JobRegistration`** (or array) from the extension’s **`getJobs()`**—see [`modules/extensions/jobs.ts`](../../../modules/extensions/jobs.ts) (`registerExtensionJobs`).
2. No `coreHandlers` entry in this repo; the extension’s `jobType` is merged in `getHandlers(extensionJobs)`.

**Queue delivery** uses the **same handler map**; `enqueueAndDispatchJob` creates the job row then the consumer calls the handler for that `job_type`.
