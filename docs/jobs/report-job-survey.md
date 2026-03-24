# Report: Job System Survey

## Job Inventory

### All Known Job Types

| Job Type | Package | Handler | Sync/Async | Purpose |
|---|---|---|---|---|
| `CHECK` | scms-server (core) | `checkHandler` | **Async** — publishes to Pub/Sub, worker PATCHes back | Dispatches a check to an external check service via Pub/Sub |
| `CLI_CHECK` | scms-server (core) | `checkCLIHandler` | **Async** — creates QUEUED row, CLI polls/patches | Creates a job record for CLI-initiated checks (no Pub/Sub) |
| `PUBLISH` | scms-server (core) | `publishHandler` | **Sync** — handler runs to completion inline | Copies files from private CDN to public CDN, updates submission status to PUBLISHED, sends notifications |
| `UNPUBLISH` | scms-server (core) | `unpublishHandler` | **Sync** — handler runs to completion inline | Reverses a publish: removes public files, updates submission to UNPUBLISHED |
| `CONVERTER_TASK` | scms-server (core) | `converterTaskHandler` | **Async** — publishes to Pub/Sub (task-converter), worker PATCHes back | Sends a work version to the converter service for PDF export (docx → PDF) |
| `PMC_WORKFLOW_SYNC` | hhmi-os-ext/pmc | `pmcWorkflowSyncHandler` | **Sync** — runs to completion inline | Syncs PMC workflow state with submission versions |
| `HHMI_GRANTS_SYNC` | hhmi-os-ext/pmc | `hhmiGrantsSyncHandler` | **Sync** — runs to completion inline | Syncs HHMI grant data |
| `PMC_DEPOSIT_FTP` | hhmi-os-ext/pmc | `pmcDepositHandler` | **Async** — publishes to Pub/Sub, worker PATCHes back | Deposits a package to PMC via FTP through a Pub/Sub worker |
| `TEXT_INTEGRITY_SUBMIT` | hhmi-checks/text-integrity | `textIntegritySubmitHandler` | **Sync** — makes HTTP call and completes inline | Submits work to iThenticate text integrity check service |
| `PROOFIG_SUBMIT` | hhmi-checks/proofig | `proofigSubmitHandler` | **Async** — publishes to Pub/Sub, worker PATCHes back | Submits a PDF to Proofig image integrity check via Pub/Sub |
| `PROOFIG_SUBMIT_STREAM` | hhmi-checks/proofig | `proofigSubmitStreamHandler` | **Sync** — streams HTTP POST to Proofig and completes inline | Submits a PDF to Proofig via direct HTTP streaming POST (no Pub/Sub) |

### Sync vs Async Summary

**Sync jobs** (handler runs to completion before the invoke returns):
- `PUBLISH`, `UNPUBLISH`, `PMC_WORKFLOW_SYNC`, `HHMI_GRANTS_SYNC`, `TEXT_INTEGRITY_SUBMIT`, `PROOFIG_SUBMIT_STREAM`

**Async jobs** (handler creates a QUEUED/RUNNING job, dispatches to external worker, worker PATCHes back):
- `CHECK`, `CLI_CHECK`, `CONVERTER_TASK`, `PMC_DEPOSIT_FTP`, `PROOFIG_SUBMIT`

---

## Job Lifecycle

### Creation

All jobs are created through one code path: `jobs.invoke(ctx, data, extensionJobs)` defined in `packages/scms-server/src/backend/loaders/jobs/invoke.server.ts`.

`invoke()` does:
1. Looks up the handler for `data.job_type` in the merged core + extension handler map
2. Creates a `StorageBackend` if the job type requires one (PUBLISH, UNPUBLISH, and any extension with `requiresStorageBackend: true`)
3. Calls the handler: `handlers[job_type](ctx, data, storageBackend)`
4. The handler internally calls `dbCreateJob(data)` to insert the job row
5. Optionally creates a work activity record if `activity_type` is set on the data
6. Returns `formatJobDTO(ctx, dbo)` — the job as a DTO

### Two Ways to Reach `invoke()`

#### 1. API endpoint — `POST /api/v1/jobs`

**File:** `platform/scms/app/routes/api/v1.jobs.tsx`

External callers (or internal `fetch()` calls) POST to this endpoint. The route handler:
- Authenticates via session or Curvenote token
- Validates the body against a Zod schema (job_type must be in the known set of core + extension types)
- Calls `jobs.invoke(ctx, data, extensionJobs)`
- Returns 201 with the job DTO

**Used by:** The submission transition flow. When a submission version transitions to a state that `requiresJob` (e.g. PUBLISH or UNPUBLISH), `transition.server.ts` fires a `fetch(ctx.asApiUrl('/jobs'), ...)` via `waitUntil()` to POST to the jobs endpoint. This is a self-call — the server POSTs to its own API endpoint.

> **Note:** There's a TODO in `transition.server.ts:163` acknowledging this pattern doesn't actually run in the background on Vercel: `// TODO: this is not a background on on vercel! might as well call the handler and lock down /v1/jobs`

#### 2. Direct programmatic call — `jobs.invoke()` in server code

App routes and extension actions call `jobs.invoke()` directly without going through the HTTP endpoint.

**Used by:**
- `actionHelpers.server.ts` — "Export to PDF" action in the works UI calls `jobs.invoke()` with `CONVERTER_TASK`
- `checks-proofig/actions.ts` — Proofig check handler calls `jobs.invoke()` with `PROOFIG_SUBMIT`, `PROOFIG_SUBMIT_STREAM`, or `CONVERTER_TASK` (with follow-on)
- `checks-text-integrity/actions.ts` — Text integrity check calls `jobs.invoke()` with `TEXT_INTEGRITY_SUBMIT`
- `hhmi-os-ext/pmc/routes` — PMC workflow sync and grants sync routes call `jobs.invoke()` with their respective job types
- PMC workflow sync webhook (`v1.hooks.pmc-workflow-sync.ts`) calls `jobs.invoke()`

### Is creation consistent?

**Mostly yes.** Every job goes through `jobs.invoke()` → handler → `dbCreateJob()`. The one inconsistency is:

- **Transition-based jobs** (PUBLISH/UNPUBLISH) go through `fetch('/api/v1/jobs')` instead of calling `jobs.invoke()` directly. This adds an extra HTTP hop and auth forwarding overhead. The TODO in the code suggests this should be changed.

All handlers call `dbCreateJob()` themselves — the initial status varies:
- Most set `JobStatus.QUEUED` (the default)
- PUBLISH sets `JobStatus.RUNNING` immediately (since it executes synchronously)
- CONVERTER_TASK sets `JobStatus.QUEUED`, then updates to `RUNNING` after publishing to Pub/Sub

### API `POST /api/v1/jobs` vs Direct `jobs.invoke()` — Differences

| Aspect | API endpoint | Direct invoke |
|---|---|---|
| Auth | Session cookie, Curvenote token, or handshake | Already within an authenticated context |
| Validation | Zod schema validates body (job_type checked against known types) | Handler validates its own payload |
| HTTP overhead | Yes — request/response cycle, JSON serialization | No — direct function call |
| Error handling | HTTP error responses (4xx/5xx) | Throws exceptions caught by calling code |
| Used for | Transition-based jobs (self-call via `waitUntil`), external callers | App actions, extension actions |

---

## Job Completion

### Sync jobs

The handler runs the full operation inline, calling `dbUpdateJob()` with `JobStatus.COMPLETED` (or `FAILED`) before returning. The job is done by the time `invoke()` returns.

Example (PUBLISH):
```
invoke() → publishHandler() → dbCreateJob(RUNNING) → copy files → update submission
  → dbUpdateJob(COMPLETED) → return job
```

### Async jobs

The handler dispatches work to an external system (Pub/Sub message), then returns. The external worker later calls `PATCH /api/v1/jobs/:jobId` with a handshake token to update status.

Example (CONVERTER_TASK):
```
invoke() → converterTaskHandler() → dbCreateJob(QUEUED) → publishConverterMessage()
  → dbUpdateJob(RUNNING) → return job
          ↓ (later, external worker)
PATCH /api/v1/jobs/:jobId { status: "COMPLETED", results: {...} }
  → jobs.update() → dbUpdateJob() → triggerFollowOn() → return
```

### The update endpoint — `PATCH /api/v1/jobs/:jobId`

**File:** `platform/scms/app/routes/api/v1.jobs.$jobId.tsx`

- Authorized via Curvenote token or **handshake token** (JWT signed with a shared secret, containing the jobId)
- Validates: `{ status: JobStatus, message?: string, results?: object }`
- Rejects updates to already-COMPLETED or FAILED jobs
- Calls `jobs.update()` which:
  1. Calls `dbUpdateJob()` to persist the status change
  2. If the new status is `COMPLETED` and extensionJobs are available, calls `triggerFollowOn()`

### Handshake tokens

For async jobs, the handler creates a handshake JWT (`createHandshakeToken()`) containing the job ID, job type, issuer, and signing secret. This token is sent along with the Pub/Sub message (as a message attribute). The external worker includes it as an `Authorization` header when PATCHing back. The PATCH endpoint validates that the token's `jobId` claim matches the route param.

---

## Follow-On Jobs

### How they work

A job can carry a `follow_on` field containing a `FollowOnEnvelope`:
```ts
{
  $schema: { /* JSON Schema for this envelope */ },
  on_success: {
    job_type: string,        // the follow-on job type
    id?: string,             // optional pre-generated UUID
    payload: object,         // payload for the follow-on job
    activity_type?: string,  // optional activity to create
    activity_data?: object,  // data for that activity
  }
}
```

When a job with `follow_on` reaches `COMPLETED` status:
1. `jobs.update()` detects `status === 'COMPLETED'`
2. Calls `triggerFollowOn(ctx, jobId, createJobFn)`
3. `triggerFollowOn()` reads the job's `follow_on` from DB, parses with relaxed Zod schema, and calls `createJobFn()` (which is `invoke()`) with the spec
4. The follow-on job is created and runs through the normal lifecycle

### Where follow-on jobs are used

**Only one place in the codebase uses follow-on jobs:**

**File:** `extensions/hhmi-checks/packages_/checks-proofig/src/server/actions.ts` (lines 176-206)

When Proofig needs to check a **DOCX** file (not a PDF), it can't submit the DOCX directly — it needs a PDF first. The flow is:

1. Create a `CONVERTER_TASK` job to convert DOCX → PDF
2. Attach a `follow_on` with `job_type: PROOFIG_SUBMIT_STREAM` (or `PROOFIG_SUBMIT`)
3. When the converter task COMPLETES, the follow-on triggers the Proofig submit

```
CONVERTER_TASK (docx→pdf)
  └─ on_success → PROOFIG_SUBMIT_STREAM (submit PDF to Proofig)
```

This is the only chaining pattern in the codebase. The `buildFollowOnEnvelope()` helper from scms-core creates the envelope with the inline JSON Schema for the follow-on structure.

---

## Where Jobs Are Invoked (by caller)

| Caller | Job Type | Invocation | Location |
|---|---|---|---|
| Submission transition (PUBLISH) | `PUBLISH` | `fetch('/api/v1/jobs')` via `waitUntil` | `scms-server: transition.server.ts:164` |
| Submission transition (UNPUBLISH) | `UNPUBLISH` | `fetch('/api/v1/jobs')` via `waitUntil` | `scms-server: transition.server.ts:164` |
| "Export to PDF" app action | `CONVERTER_TASK` | `jobs.invoke()` direct | `platform: actionHelpers.server.ts:74` |
| Proofig check (PDF available) | `PROOFIG_SUBMIT` or `PROOFIG_SUBMIT_STREAM` | `jobs.invoke()` direct | `checks-proofig: actions.ts:160` |
| Proofig check (DOCX, needs convert) | `CONVERTER_TASK` + follow-on | `jobs.invoke()` direct | `checks-proofig: actions.ts:189` |
| Text integrity check | `TEXT_INTEGRITY_SUBMIT` | `jobs.invoke()` direct | `checks-text-integrity: actions.ts:113` |
| PMC workflow sync (UI) | `PMC_WORKFLOW_SYNC` | `jobs.invoke()` direct | `pmc: $siteName.workflow-sync.tsx:99` |
| PMC workflow sync (webhook) | `PMC_WORKFLOW_SYNC` | `jobs.invoke()` direct | `pmc: v1.hooks.pmc-workflow-sync.ts:41` |
| PMC deposit | `PMC_DEPOSIT_FTP` | `jobs.invoke()` direct | (invoked via workflow sync handler internally) |
| HHMI grants sync | `HHMI_GRANTS_SYNC` | `jobs.invoke()` direct | (invoked via PMC extension routes) |
| Check dispatch (Pub/Sub) | `CHECK` | `POST /api/v1/jobs` (external) | External check services call the API |
| CLI check | `CLI_CHECK` | `POST /api/v1/jobs` (external) | CLI tools call the API |

---

## Where Jobs Are Queried (read-only)

| Location | Purpose |
|---|---|
| `ee/sites: $siteName.submissions._index/db.server.ts` | List RUNNING PUBLISH/UNPUBLISH jobs for submission list UI |
| `ee/sites: $siteName.submissions.$submissionId/route.tsx` | List RUNNING PUBLISH/UNPUBLISH jobs for submission detail UI |
| `ee/sites: $siteName.inbox/db.server.ts` | List RUNNING PUBLISH/UNPUBLISH jobs for inbox UI |
| `GET /api/v1/jobs/:jobId` | External workers poll job status, UI fetches job details |

---

## Observations

1. **PUBLISH/UNPUBLISH use `fetch()` self-call instead of direct `invoke()`** — the only job types created this way. There's a TODO to change this. Every other caller uses `jobs.invoke()` directly.

2. **Sync jobs block the HTTP response** — PUBLISH can take several seconds (file copy + DB updates + Slack + email). The `waitUntil()` in the transition flow attempts to make this non-blocking, but the TODO notes this doesn't actually work on Vercel.

3. **Follow-on is used in exactly one place** — Proofig DOCX→PDF→submit chain. The infrastructure (envelope, JSON Schema, trigger, relaxed parsing) is general-purpose but currently single-use.

4. **Extension jobs register via `getJobs()`** — returns `JobRegistration[]` with `{ jobType, handler, requiresStorageBackend? }`. This is clean and consistent across all extensions.

5. **No job cancellation flow** — the `CANCELLED` status exists in the enum but there's no handler or API support for cancelling a running async job (e.g. telling a Pub/Sub worker to abort).

6. **No retry logic** — if an async job's worker fails silently (no PATCH back), the job stays RUNNING forever. There's no timeout or cleanup.

7. **Handshake tokens are only used by async jobs** — CHECK, CONVERTER_TASK, PMC_DEPOSIT_FTP, and PROOFIG_SUBMIT all create handshake tokens for their workers. Sync jobs don't need them.
