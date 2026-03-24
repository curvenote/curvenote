# Jobs: dispatch

**Centralized async job dispatch** over **one Pub/Sub topic** (`scmsJobDispatch`). Callers publish a message and return immediately; **`POST /v1/jobs/dispatch`** (push) creates the job row and runs the normal [`handlers`](../handlers) pipeline—so work is **decoupled** from the HTTP request that triggered `dispatchAJob`.

Use this when you want **fire-and-forget** jobs (transitions, background steps) instead of doing the same work inside the route or handler.

**Not** the same as topic-specific Pub/Sub in [`../processing`](../processing) (checks, converter, etc.)—those are separate topics and workers.

## Adding a new dispatchable job type

1. **Handler** — Implement and register a job handler for your `job_type` (see [`../handlers/README.md`](../handlers/README.md)).
2. **Message body** — Add a small **`messages/<name>.server.ts`** module that builds the Pub/Sub message body as [`DispatchJobParams`](./dispatch.ts) (typed payload, `job_type`, optional `activity_*` / `follow_on`). Use [`utils.ts`](./utils.ts) `newDispatchJobId()` unless you need a fixed id.
3. **Export** — Re-export the message builder from [`index.ts`](./index.ts).
4. **Call site** — `await dispatchAJob(createConverterTaskDispatchMessageBody({ ... }))` from [`dispatch.ts`](./dispatch.ts) (or spread params and override `job_id` if needed).

Config: `pubsubProjectId`, `dispatchTopic`, `dispatchSASecretKeyfile` in app config. In dev, **`DEV_PUBSUB_DISPATCH=true`** uses real Pub/Sub; otherwise the client POSTs to the local dispatch URL.
