# Plan: Activity feed for Export to PDF and Start CHECKS

## Goal

Log work-scoped activities when:

1. **Export to PDF** is triggered (user clicks “Generate PDF”).
2. **Start CHECKS** is triggered (user confirms work and one or more extension checks are executed).

Both should appear on the work details timeline with the existing activity stack.

---

## 1. Activity stack to use

**Use the existing work activity stack.**

- **Model:** `Activity` (Prisma), with `work_id`, `work_version_id`, `activity_by_id`, `activity_type`.
- **Loader:** `dbGetWorkActivities(workId)` in `platform/scms/app/routes/app/works.$workId/db.server.ts` (returns `WorkActivityRow[]`).
- **UI:** Activities are rendered in `WorkVersionTimeline` → `ActivityTimelineItem` (and related timeline components).

No new stack; we only add new activity types and create them in the right places.

---

## 2. Export to PDF – activity type and where to create

### Activity type

- **Recommendation:** Add a **new** activity type. There is no existing “job started” or “export” type.
- **Suggested enum value:** `EXPORT_TO_PDF_STARTED` (or `PDF_EXPORT_REQUESTED`).
- **Schema change:** Add to `ActivityType` in `prisma/schema/activity.prisma` and add a migration.

### Exact place to create the activity

**File:** `platform/scms/app/routes/app/works.$workId/actionHelpers.server.ts`  
**Function:** `exportToPdfAction`  
**Location:** Immediately **after** `jobs.invoke(...)` returns successfully (after the `try` block that returns `data({ success: true, jobId: dto.id })`), and **before** that return.

- We have: `ctx.work.id`, `workVersionId` (from parsed form), `ctx.user` (for `activity_by`).
- Create one activity per “Export to PDF” request with:
  - `work_id` = `ctx.work.id`
  - `work_version_id` = `workVersionId`
  - `activity_by_id` = `ctx.user.id`
  - `activity_type` = `EXPORT_TO_PDF_STARTED`

**Optional later:** “PDF export completed” when the async job is PATCHed to `COMPLETED` would require creating an activity in the job update flow (e.g. in `packages/scms-server` jobs update after `dbUpdateJob`) and resolving job → `linkedJob` → `work_version_id` → `work_id`. You’d also need to store the requesting user on the job (or linked row) at creation time to set `activity_by_id`. Not in scope for this plan.

---

## 3. Start CHECKS – activity type and metadata for “which check”

### Activity type

- **Recommendation:** Add a **new** activity type for checks run by extensions.
- **Suggested enum value:** `CHECK_STARTED`.
- **Schema change:** Add to `ActivityType` in `prisma/schema/activity.prisma` and add a migration.

Create **one activity per check** that is started (one per `enabledChecks` item that is actually executed), so the timeline can show “Proofig check started”, “Image integrity check started”, etc., and different extensions are represented separately.

### Representing “which check” in metadata

Extensions register checks with an **id** (e.g. `'proofig'`, `'curvenote-structure'`) and a **name** (display name). We need to store which check was run so the timeline can show a sensible label.

**Option A (recommended):** Use the existing **`transition`** (Json) field on `Activity`.

- Convention: for `CHECK_STARTED`, set `transition` to `{ checkKind: string }` where `checkKind` is the extension check service **id** (e.g. `'proofig'`).
- No schema change. The timeline can resolve `checkKind` to a display name when rendering (e.g. from extension config or a small map); if unknown, fall back to “Check started” or the raw id.

**Option B:** Add a dedicated **`metadata`** (or `details`) Json column to `Activity` for extension-specific payloads.

- Cleaner long-term and avoids overloading `transition` (which is used for submission version transitions).
- Requires a Prisma migration.

**Recommendation:** Use **Option A** (`transition`) for now so we don’t add a new column. If you prefer a clear separation, use Option B and set e.g. `metadata = { checkKind: 'proofig' }`.

**UI:** In `ActivityTimelineItem` (or a helper), when `activity_type === 'CHECK_STARTED'` and `activity.transition?.checkKind` exists, show a label like “{displayName} check started”. Display name can come from a static map (e.g. `proofig` → “Proofig”) or from the same extension config that provides `ExtensionCheckService.name` (if available in the route that renders the timeline).

---

## 4. Start CHECKS – exact place to create the activity

**File:** `platform/scms/app/routes/app/works.$workId.upload.$workVersionId/route.tsx`  
**Block:** The `confirm-work` intent handler.  
**Location:** Inside the loop over `enabledChecks`, **after** each successful `service.handleAction(actionArgs)` (around line 271). Create one activity per check that was actually invoked (when `service?.handleAction` exists and was called).

- We have: `workId` (from route params), `workVersionId`, `baseCtx.user.id`, and the loop variable `kind` (the check service id, e.g. `'proofig'`).
- For each such check, create an activity with:
  - `work_id` = `workId`
  - `work_version_id` = `workVersionId`
  - `activity_by_id` = `baseCtx.user.id`
  - `activity_type` = `CHECK_STARTED`
  - `transition` = `{ checkKind: kind }` (or `metadata` if you add the column)

**Code context (snippet):**

```ts
// Existing loop (around 257–276):
if (enabledChecks.length > 0) {
  const checkServices = getExtensionCheckServicesFromServerConfig(...);
  for (const kind of enabledChecks) {
    const service = checkServices.find((s) => s.id === kind);
    if (!service?.handleAction) continue;
    const actionArgs: ExtensionCheckHandleActionArgs = { ... };
    const res = await service.handleAction(actionArgs);
    if (!res.ok) { ... }
    // INSERT HERE: create activity for this check (workId, workVersionId, baseCtx.user.id, CHECK_STARTED, { checkKind: kind })
  }
}
```

---

## 5. Shared activity creation

To avoid duplicating the `activity.create` logic and to keep work activities consistent with existing patterns (e.g. `DRAFT_WORK_VERSION_STARTED` in `packages/scms-server/src/backend/db.server.ts`), introduce a small helper used by both flows.

**Option A:** Add a function in **packages/scms-server** (e.g. in `packages/scms-server/src/backend/db.server.ts` or a dedicated work-activities module) such as:

- `createWorkActivity(prisma, { workId, workVersionId, activityById, activityType, transition?: object })`

Then:

- **Export to PDF:** In `exportToPdfAction`, after successful `jobs.invoke`, call this helper with `activityType: 'EXPORT_TO_PDF_STARTED'`, no `transition`.
- **Checks:** In the upload route’s `confirm-work` block, after each successful `service.handleAction`, call the same helper with `activityType: 'CHECK_STARTED'`, `transition: { checkKind: kind }`.

**Option B:** Add the same helper in **platform** (e.g. in `platform/scms/app/routes/app/works.$workId/db.server.ts`) and call it from `actionHelpers.server.ts` and from the upload route. This keeps activity creation in the app layer but duplicates the pattern used for `DRAFT_WORK_VERSION_STARTED` in scms-server.

**Recommendation:** Option A (helper in scms-server) so work activities are created in one place and the platform only calls in with the right parameters.

---

## 6. Loader and UI updates

- **`dbGetWorkActivities`** (and thus **`WorkActivityRow`**): Include the **`transition`** field in the query and in the returned row type so the timeline can read `checkKind` for `CHECK_STARTED` and show a per-check label.
- **`ActivityTimelineItem`** (and any shared label helper): Extend the label map to include:
  - `EXPORT_TO_PDF_STARTED` → e.g. “Export to PDF started”
  - `CHECK_STARTED` → use `transition?.checkKind` to show e.g. “{displayName} check started” (with a fallback when `checkKind` is missing or unknown).

---

## 7. Summary table

| Event                 | Activity type (new)     | Where to create                                                                 | Metadata / notes                          |
|----------------------|-------------------------|----------------------------------------------------------------------------------|------------------------------------------|
| Export to PDF        | `EXPORT_TO_PDF_STARTED` | `platform/scms/app/routes/app/works.$workId/actionHelpers.server.ts` in `exportToPdfAction` after successful `jobs.invoke` | None needed                              |
| Start CHECKS (each)  | `CHECK_STARTED`         | `platform/scms/app/routes/app/works.$workId.upload.$workVersionId/route.tsx` in `confirm-work` block, after each `service.handleAction` | `transition: { checkKind: kind }` (kind = extension check id) |

---

## 8. Files to touch (when implementing)

1. **Prisma:** `prisma/schema/activity.prisma` – add `EXPORT_TO_PDF_STARTED` and `CHECK_STARTED` to enum; new migration.
2. **Activity creation:** New helper (e.g. in scms-server) `createWorkActivity(...)` and call it from:
   - `platform/scms/app/routes/app/works.$workId/actionHelpers.server.ts` (export to PDF).
   - `platform/scms/app/routes/app/works.$workId.upload.$workVersionId/route.tsx` (checks loop).
3. **Loader / type:** `platform/scms/app/routes/app/works.$workId/db.server.ts` – include `transition` in `dbGetWorkActivities` and in `WorkActivityRow`.
4. **UI:** `platform/scms/app/routes/app/works.$workId.details/timeline/ActivityTimelineItem.tsx` – add labels for the two new types; for `CHECK_STARTED`, use `transition?.checkKind` for display.

No code changes were made in this planning step; this document is for implementation only.
