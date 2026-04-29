# Plan: Centralized Pub/Sub Job Dispatch

## Goal

Replace direct `jobs.invoke()` calls and the `waitUntil(fetch('/api/v1/jobs'))` self-call pattern with a centralized Pub/Sub dispatch topic (`scmsJobDispatch`). All internal job creation flows through this topic, decoupling callers from handlers and enabling true background execution on Vercel.

See `jobs/before/` and `jobs/after/` for before/after flow diagrams.

## Design Decisions

| Decision | Choice |
|---|---|
| Internal dispatch mechanism | Pub/Sub topic `scmsJobDispatch` |
| External/CLI dispatch | `POST /api/v1/jobs` stays as-is |
| DB row creation | Option B — dispatch endpoint creates the row (not the caller) |
| Caller return value | `{ job_id, job_type, status: 'DISPATCHED' }` (no DB row yet) |
| Handler-specific worker topics | Unchanged — two-hop for CHECK, CONVERTER_TASK, PROOFIG_SUBMIT, PMC_DEPOSIT_FTP |
| Follow-on trigger | Publishes to `scmsJobDispatch` topic (no request chaining) |
| Auth on dispatch messages | Handshake JWT in message attributes |
| Error handling | Dead letter topic + job reaper for stuck RUNNING jobs |
| Status cascade | (no row) → QUEUED → RUNNING → COMPLETED/FAILED |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNAL CALLERS                       │
│  app actions, extension actions, transition flow,         │
│  follow-on triggers                                       │
│                                                           │
│  dispatchJob({ job_id, job_type, payload, ... })          │
│     → publish to scmsJobDispatch topic                    │
│     → return { job_id }                                   │
└────────────────────────┬────────────────────────────────┘
                         │ Pub/Sub push
                         ▼
┌─────────────────────────────────────────────────────────┐
│          POST /api/v1/jobs/dispatch (NEW)                 │
│  auth: handshake JWT from message attributes              │
│  1. Create DB row (QUEUED)                                │
│  2. Resolve + run handler                                 │
│  3. Handler updates status (RUNNING/COMPLETED/FAILED)     │
│  4. If COMPLETED + follow_on → publish to scmsJobDispatch │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          POST /api/v1/jobs (EXISTING — unchanged)         │
│  auth: session / curvenote token                          │
│  Used by: CLI, external callers                           │
│  Creates DB row + runs handler directly (no Pub/Sub)      │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Infrastructure — Pub/Sub Topic + Dispatch Endpoint

#### 1.1 Create Pub/Sub setup script

**New file:** `packages/scms-tasks/scripts/pubsub-dispatch.sh`

Based on the existing `pubsub.sh` pattern but configured for the dispatch topic. Creates:

- Topic: `scmsJobDispatch`
- Dead letter topic: `scmsJobDispatch-deadletter`
- Push subscription: `scmsJobDispatch-sub` → pushes to `{PUSH_ENDPOINT}/api/v1/jobs/dispatch`
- Dead letter subscription: `scmsJobDispatch-deadletter-sub` → pushes to `{PUSH_ENDPOINT}/api/v1/jobs/dispatch/dlq`
- Max delivery attempts: 5
- Ack deadline: 600s (matching existing pattern)
- Service account with `roles/run.invoker` + `roles/pubsub.publisher`

Key differences from the existing `pubsub.sh`:
- Adds `--dead-letter-topic` and `--max-delivery-attempts` to the subscription creation
- Creates the dead letter topic and a subscription for it
- Push endpoint is the SCMS application itself (not an external worker)

#### 1.2 Add config entries to `app-config`

**File:** `types/app-config.d.ts`

Add to the `api` section:
```typescript
/** GCP project ID for all Pub/Sub clients */
pubsubProjectId: string;
/** Pub/Sub topic for centralized job dispatch (e.g. scmsJobDispatch) */
dispatchTopic: string;
/** Service account JSON keyfile for publishing to dispatch topic */
dispatchSASecretKeyfile: string;
```

#### 1.3 Create the `dispatchJob()` helper

**New file:** `packages/scms-server/src/backend/loaders/jobs/dispatch.server.ts`

This is the single function all internal callers use instead of `jobs.invoke()`.

```typescript
export interface DispatchJobParams {
  job_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  invoked_by_id?: string;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
  follow_on?: FollowOnEnvelope;
}

export interface DispatchResult {
  job_id: string;
  job_type: string;
  status: 'DISPATCHED';
}

export async function dispatchJob(params: DispatchJobParams): Promise<DispatchResult>
```

Internally:
1. Signs a handshake JWT containing `job_id` and `job_type`
2. Publishes to `scmsJobDispatch` topic with:
   - **data:** JSON-encoded `DispatchJobParams`
   - **attributes:** `{ handshake: <JWT>, job_type: <string> }` (job_type attribute for observability/filtering)
3. Returns `{ job_id, job_type, status: 'DISPATCHED' }`

Development mode: follows the existing pattern from `processing.server.ts` — in dev/test, call `http://127.0.0.1:<port>/api/v1/jobs/dispatch` directly (or call the handler inline) instead of hitting real Pub/Sub.

#### 1.4 Typed factory functions per job type

**New file:** `packages/scms-server/src/backend/loaders/jobs/dispatch-factories.server.ts`

Typed wrappers that produce `DispatchJobParams` with correct payload shapes:

```typescript
export function dispatchConverterTask(params: {
  work_version_id: string;
  target: string;
  conversion_type: string;
  invoked_by_id?: string;
  follow_on?: FollowOnEnvelope;
}): DispatchJobParams

export function dispatchPublishJob(params: {
  site_id: string;
  user_id: string;
  submission_version_id: string;
  cdn: string;
  key: string;
  date_published?: string;
  updates_slug?: boolean;
}): DispatchJobParams

export function dispatchCheckJob(params: { ... }): DispatchJobParams
// etc. for each known job type
```

Each factory:
- Generates `job_id` via `uuidv7()`
- Sets the correct `job_type`
- Sets `activity_type`/`activity_data` where appropriate (e.g. CONVERTER_TASK always gets `CONVERTER_TASK_STARTED`)
- Returns a fully-typed `DispatchJobParams`

Also export a generic `dispatchExtensionJob()` for extension job types that don't have a typed factory.

#### 1.5 Create the dispatch endpoint

**New file:** `platform/scms/app/routes/api/v1.jobs.dispatch.tsx`

Receives Pub/Sub push messages. The handler:

1. **Parse Pub/Sub envelope:** Extract `message.data` (base64 → JSON → `DispatchJobParams`) and `message.attributes.handshake`
2. **Verify handshake:** Validate the JWT, confirm `job_id` and `job_type` match the message data
3. **Create DB row:** `dbCreateJob({ ...params, status: JobStatus.QUEUED })` — use upsert semantics (if row exists from a retry, update rather than fail)
4. **Resolve handler:** Look up `handlers[job_type]` from core + extension registry
5. **Create StorageBackend** if needed (same logic as current `invoke.server.ts`)
6. **Run handler:** `handler(ctx, data, storageBackend)`
7. **Create work activity** if `activity_type` is set (same logic as current `invoke.server.ts`)
8. **Check follow-on:** If the handler completed synchronously (COMPLETED) and `follow_on` exists, call `dispatchJob()` to publish the follow-on to the topic
9. **Return 200** to ack the message (or non-200 to trigger Pub/Sub retry)

Error handling:
- Transient errors (DB connection, CDN timeout) → return 500 → Pub/Sub retries
- Permanent errors (bad payload, unknown job type) → update job to FAILED, return 200 (ack, no retry)
- Handler throws → catch, update job to FAILED if row exists, return 200 for permanent errors or 500 for transient

#### 1.6 Create the dead letter endpoint

**New file:** `platform/scms/app/routes/api/v1.jobs.dispatch/dlq.route.tsx`

Receives messages that exceeded max delivery attempts. The handler:

1. Parse the original message data
2. Create/update the job row as FAILED with message: "Job dispatch failed after maximum retries"
3. Log the failure for alerting
4. Return 200 (always ack dead letters)

---

### Phase 2: Migrate Callers

Each caller currently calling `jobs.invoke()` or `fetch('/api/v1/jobs')` switches to `dispatchJob()`. The return value changes from a full `JobDTO` to `{ job_id, job_type, status: 'DISPATCHED' }`.

#### 2.1 Export `dispatchJob` and factories from `@curvenote/scms-server`

**File:** `packages/scms-server/src/backend/loaders/jobs/index.ts`

Add exports for `dispatchJob` and the typed factories. Keep `invoke` exported for the existing `POST /api/v1/jobs` endpoint (CLI path).

**File:** `packages/scms-server/src/index.ts`

Ensure the new exports are re-exported.

#### 2.2 Migrate: Export to PDF action

**File:** `platform/scms/app/routes/app/works.$workId/actionHelpers.server.ts`

Before:
```typescript
const dto = await jobs.invoke(ctx, { id: uuidv7(), job_type: 'CONVERTER_TASK', ... }, registerExtensionJobs(extensions));
return data({ success: true, jobId: dto.id });
```

After:
```typescript
const result = await dispatchJob(dispatchConverterTask({
  work_version_id: workVersionId,
  target: 'pdf',
  conversion_type: 'docx-pandoc-myst-pdf',
  invoked_by_id: ctx.user?.id,
}));
return data({ success: true, jobId: result.job_id });
```

No UI changes needed — caller already treats this as async (returns job ID for polling).

#### 2.3 Migrate: Submission transition (PUBLISH/UNPUBLISH)

**File:** `packages/scms-server/src/backend/loaders/sites/submissions/versions/transition.server.ts`

Before (lines 149-183):
```typescript
const headers = new Headers();
// ... 12 lines of auth header forwarding ...
waitUntil(fetch(ctx.asApiUrl('/jobs'), { method: 'POST', headers, body: JSON.stringify({...}) }));
```

After:
```typescript
await dispatchJob(dispatchPublishJob({
  site_id: existing.submission.site_id,
  user_id: ctx.user!.id,
  submission_version_id: updated.id,
  cdn: existing.work_version.cdn,
  key: existing.work_version.cdn_key,
  date_published: transition.options?.setsPublishedDate ? datePublished : undefined,
  updates_slug: transition.options?.updatesSlug,
}));
```

This eliminates:
- The entire auth header forwarding block
- The `waitUntil(fetch(...))` self-call
- The TODO about Vercel not actually backgrounding

The `jobId` is pre-generated inside `dispatchPublishJob()` and needs to be stored on the transition state. Adjust factory to accept an optional `job_id` parameter, or have the transition code pre-generate and pass it:

```typescript
const jobId = uuidv7();
await dispatchJob({
  ...dispatchPublishJob({ ... }),
  job_id: jobId,  // override the factory-generated ID
});
```

#### 2.4 Migrate: Proofig check action

**File:** `extensions/hhmi-checks/packages_/checks-proofig/src/server/actions.ts`

Two paths:

**PDF available (direct submit):**
```typescript
// Before: jobs.invoke(ctx, { id: uuid(), job_type: jobType, payload: {...}, ... }, extensionJobs);
// After:
await dispatchJob({
  job_id: uuid(),
  job_type: jobType,  // PROOFIG_SUBMIT or PROOFIG_SUBMIT_STREAM
  payload: { work_version_id: workVersionId, proofig_run_id: checkRunId },
  invoked_by_id: ctx.user?.id,
  activity_type: 'CHECK_STARTED',
  activity_data: { check: { kind: 'proofig' } },
});
```

**DOCX (converter + follow-on):**
```typescript
// Before: jobs.invoke(ctx, { id: exportJobId, job_type: CONVERTER_TASK, follow_on: buildFollowOnEnvelope(...), ... }, extensionJobs);
// After:
await dispatchJob({
  job_id: exportJobId,
  job_type: KnownJobTypes.CONVERTER_TASK,
  payload: { work_version_id: workVersionId, target: 'pdf', conversion_type: 'docx-lowriter-pdf' },
  follow_on: buildFollowOnEnvelope(followOnSpec),
  invoked_by_id: ctx.user?.id,
  activity_type: 'CONVERTER_TASK_STARTED',
  activity_data: { converter: { target: 'pdf', type: 'docx-lowriter-pdf' } },
});
```

The follow-on spec is unchanged — it still describes the next job. The difference is that when the converter task COMPLETES, the dispatch endpoint (not `invoke()`) publishes the follow-on to the Pub/Sub topic.

#### 2.5 Migrate: Text integrity check

**File:** `extensions/hhmi-checks/packages_/checks-text-integrity/src/server/actions.ts`

Same pattern — replace `jobs.invoke()` with `dispatchJob()`.

#### 2.6 Migrate: PMC workflow sync (UI route)

**File:** `extensions/hhmi-os-ext/packages/pmc/src/routes/$siteName.workflow-sync.tsx`

```typescript
// Before: const dto = await jobs.invoke(ctx, { ... }, getJobs());
// After:
const result = await dispatchJob({ job_id: uuidv7(), job_type: 'PMC_WORKFLOW_SYNC', payload: {...}, invoked_by_id: ctx.user?.id });
return { success: true, jobId: result.job_id };
```

#### 2.7 Migrate: PMC workflow sync (webhook)

**File:** `extensions/hhmi-os-ext/packages/pmc/src/routes/v1.hooks.pmc-workflow-sync.ts`

Same pattern.

#### 2.8 Migrate: HHMI grants sync

**File:** `extensions/hhmi-os-ext/packages/pmc/src/routes/$siteName.grants.tsx`

Same pattern.

#### 2.9 Migrate: PMC deposit

Wherever PMC deposit jobs are invoked — same pattern.

---

### Phase 3: Update Follow-On Trigger

#### 3.1 Modify `triggerFollowOn` to publish instead of invoke

**File:** `packages/scms-server/src/backend/loaders/jobs/trigger-follow-on.server.ts`

Before:
```typescript
await createJobFn(ctx, createJobData);  // calls invoke() which calls handler directly
```

After:
```typescript
await dispatchJob({
  job_id: id,
  job_type: on_success.job_type,
  payload: on_success.payload,
  invoked_by_id: job.invoked_by_id ?? undefined,
  activity_type: on_success.activity_type,
  activity_data: on_success.activity_data,
});
```

This removes:
- The `CreateJobFn` type
- The `createJobFn` parameter
- The dependency on `invoke` and the extension job registry

The function signature simplifies to:
```typescript
export async function triggerFollowOn(jobId: string): Promise<void>
```

#### 3.2 Update `jobs.update()` to use simplified trigger

**File:** `packages/scms-server/src/backend/loaders/jobs/update.server.ts`

Before:
```typescript
if (dbo.status === 'COMPLETED' && extensionJobs != null) {
  const createJobFn = (c: Context, d: ...) => invoke(c, d, extensionJobs);
  await triggerFollowOn(ctx, jobId, createJobFn);
}
```

After:
```typescript
if (dbo.status === 'COMPLETED') {
  await triggerFollowOn(jobId);
}
```

The `extensionJobs` parameter is no longer needed on `jobs.update()` — the dispatch endpoint handles handler resolution.

#### 3.3 Also trigger follow-on from the dispatch endpoint

When a formerly-sync handler (PUBLISH, UNPUBLISH, etc.) completes inside the dispatch endpoint, the endpoint checks for `follow_on` and publishes. This happens in the dispatch endpoint code (step 1.5, point 8).

---

### Phase 4: Error Handling

#### 4.1 Handler idempotency

Modify `dbCreateJob` to use upsert semantics:

**File:** `packages/scms-server/src/backend/loaders/jobs/handlers/db.server.ts`

```typescript
export async function dbCreateJob(data: CreateJob) {
  const prisma = await getPrismaClient();
  return prisma.job.upsert({
    where: { id: data.id },
    create: { /* same as current */ },
    update: { /* only update if still QUEUED — don't overwrite RUNNING/COMPLETED */ },
  });
}
```

Handlers that do non-idempotent side effects (email, Slack) should check job results before re-executing. For example, PUBLISH handler checks `results.notification_sent` before sending again.

#### 4.2 Job reaper (stuck RUNNING jobs)

**New file:** `packages/scms-server/src/backend/loaders/jobs/reaper.server.ts`

```typescript
export async function reapStuckJobs(maxAgeMinutes: number = 30): Promise<number>
```

Queries for jobs with `status = RUNNING` and `date_modified < now - maxAgeMinutes`, updates them to FAILED with message "Job timed out after {maxAgeMinutes} minutes."

Can be triggered by:
- A Vercel cron route (e.g. `api/v1.jobs.reap.tsx`)
- A Cloud Scheduler job hitting that endpoint
- Manual invocation

#### 4.3 GET endpoint: handle pre-row state

**File:** `platform/scms/app/routes/api/v1.jobs.$jobId.tsx`

When `GET /api/v1/jobs/:jobId` returns null (job not found), return:
```json
{ "id": "<jobId>", "status": "DISPATCHED", "message": "Job is queued for processing" }
```

Instead of 404. This handles the brief window between Pub/Sub publish and dispatch endpoint creating the row.

Alternatively, keep the 404 and let the UI handle it (retry with backoff). This is simpler and avoids inventing a status for non-existent rows.

**Recommendation:** Return 404 for unknown IDs. The UI already polls — a brief 404 is fine. Don't conflate "not yet created" with "exists." The caller has the `job_id` and knows it dispatched, so a 404 means "not yet processed."

---

### Phase 5: Cleanup

#### 5.1 Remove `registerExtensionJobs` from caller sites

After all callers use `dispatchJob()`, the following no longer need `registerExtensionJobs(extensions)`:
- `actionHelpers.server.ts`
- `checks-proofig/actions.ts`
- `checks-text-integrity/actions.ts`
- `$siteName.workflow-sync.tsx`
- `$siteName.grants.tsx`
- `v1.hooks.pmc-workflow-sync.ts`

The extension job registry is only needed in the dispatch endpoint and the `POST /api/v1/jobs` endpoint.

#### 5.2 Simplify `jobs.update()` signature

Remove `extensionJobs` parameter from `jobs.update()`. The PATCH endpoint (`v1.jobs.$jobId.tsx`) no longer needs to pass extension jobs.

#### 5.3 Keep `jobs.invoke()` for the CLI path

`POST /api/v1/jobs` (the existing external endpoint) still calls `jobs.invoke()` directly. This is the only remaining callsite. Consider renaming it to `jobs.executeDirectly()` or similar to distinguish from the Pub/Sub path.

#### 5.4 Remove auth forwarding from transition.server.ts

The entire block (lines 150-161) that forwards auth headers for the `fetch()` self-call is deleted.

#### 5.5 Remove `waitUntil` import from transition.server.ts

No longer needed.

---

## Files Changed (Summary)

### New files

| File | Purpose |
|---|---|
| `packages/scms-tasks/scripts/pubsub-dispatch.sh` | Pub/Sub topic + subscription + dead letter setup |
| `packages/scms-server/src/backend/loaders/jobs/dispatch.server.ts` | `dispatchJob()` — publish to scmsJobDispatch |
| `packages/scms-server/src/backend/loaders/jobs/dispatch-factories.server.ts` | Typed factory functions per job type |
| `platform/scms/app/routes/api/v1.jobs.dispatch/route.tsx` | Dispatch endpoint (receives Pub/Sub push) |
| `platform/scms/app/routes/api/v1.jobs.dispatch/dlq.route.tsx` | Dead letter endpoint |
| `packages/scms-server/src/backend/loaders/jobs/reaper.server.ts` | Stuck job reaper |

### Modified files — callers

| File | Change |
|---|---|
| `platform/scms/app/routes/app/works.$workId/actionHelpers.server.ts` | `jobs.invoke()` → `dispatchJob()` |
| `packages/scms-server/src/backend/loaders/sites/submissions/versions/transition.server.ts` | `waitUntil(fetch(...))` → `dispatchJob()`, remove auth forwarding |
| `extensions/hhmi-checks/packages_/checks-proofig/src/server/actions.ts` | `jobs.invoke()` → `dispatchJob()` |
| `extensions/hhmi-checks/packages_/checks-text-integrity/src/server/actions.ts` | `jobs.invoke()` → `dispatchJob()` |
| `extensions/hhmi-os-ext/packages/pmc/src/routes/$siteName.workflow-sync.tsx` | `jobs.invoke()` → `dispatchJob()` |
| `extensions/hhmi-os-ext/packages/pmc/src/routes/$siteName.grants.tsx` | `jobs.invoke()` → `dispatchJob()` |
| `extensions/hhmi-os-ext/packages/pmc/src/routes/v1.hooks.pmc-workflow-sync.ts` | `jobs.invoke()` → `dispatchJob()` |

### Modified files — infrastructure

| File | Change |
|---|---|
| `types/app-config.d.ts` | Add `pubsubProjectId`, `dispatchTopic`, `dispatchSASecretKeyfile` |
| `packages/scms-server/src/backend/loaders/jobs/trigger-follow-on.server.ts` | Publish to topic instead of calling `invoke()` |
| `packages/scms-server/src/backend/loaders/jobs/update.server.ts` | Simplify — remove `extensionJobs` param |
| `packages/scms-server/src/backend/loaders/jobs/handlers/db.server.ts` | `dbCreateJob` → upsert for idempotency |
| `packages/scms-server/src/backend/loaders/jobs/index.ts` | Export `dispatchJob` and factories |
| `packages/scms-server/src/index.ts` | Re-export new dispatch functions |
| `platform/scms/app/routes/api/v1.jobs.$jobId.tsx` | Remove `registerExtensionJobs` from PATCH handler |
| `packages/scms-server/src/backend/processing.server.ts` | Add `publishDispatchMessage()` for the new topic |

### Modified files — tests

| File | Change |
|---|---|
| `platform/scms/tests/integration/workflow/transitions.spec.ts` | Update to verify Pub/Sub dispatch instead of `fetch('/api/v1/jobs')` |

---

## Migration Strategy

1. **Phase 1** can be implemented and deployed without changing any callers. The dispatch endpoint exists but nothing publishes to it yet.
2. **Phase 2** migrates callers one at a time. Each can be a separate PR. The existing `jobs.invoke()` path still works, so callers can be migrated incrementally.
3. **Phase 3** (follow-on) should be done after all callers are migrated, since it changes how follow-on jobs are created.
4. **Phase 4** (error handling) can be implemented at any point but should be in place before production traffic flows through the dispatch topic.
5. **Phase 5** (cleanup) is done last, after everything is verified working.

## Development / Local Testing

In development mode (`NODE_ENV === 'development'`), `dispatchJob()` should either:
- **Option A:** Call the dispatch endpoint directly via `fetch('http://localhost:3031/api/v1/jobs/dispatch', ...)` — simulates the Pub/Sub push locally
- **Option B:** Call `invoke()` inline — bypasses Pub/Sub entirely for local dev, same as today

Recommend **Option A** for closer parity with production, with a fallback to Option B if the local server isn't running (e.g. in tests).

For tests (`NODE_ENV === 'test'`), `dispatchJob()` should call the handler inline (like Option B) so tests don't depend on Pub/Sub infrastructure.
