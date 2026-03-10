# New Work and Create new version – Flows and code reference

This document describes the two entry flows for starting or resuming file uploads: **Upload Work** (from the My Works listing) and **Upload New Version** (from a work’s details page). Both flows share the same resume-draft UX (check for existing drafts, show dialog or create new, then redirect to the upload form).

**Contents**

- [Overview](#overview)
- [New Work (My Works or Dashboard)](#new-work-my-works-or-dashboard)
- [Create new version (Work Details)](#create-new-version-work-details)
- [Code locations reference](#code-locations-reference)

---

## Overview

| Flow | Trigger | Draft check scope | Creates | Redirect target |
|------|---------|-------------------|---------|-----------------|
| **Upload Work** | “Upload Work” on My Works | All draft *works* for the user (single version, with `checks` metadata) | New **work** + first draft version | `/app/works/:workId/upload/:workVersionId` |
| **Upload New Version** | “Upload New Version” on Work Details | Latest version of **this work** only (if draft and has `checks`) | New draft **version** on existing work | `/app/works/:workId/upload/:workVersionId` |

Both flows:

1. Require the `app.works.upload` scope (button only shown when `canUpload`).
2. First request a “drafts” list (different intent/API per flow).
3. If drafts exist → show **ResumeDraftWorkDialog** (resume one, create new, or delete).
4. If no drafts (or user chooses “Create new”) → create the work/version via action, then redirect to the upload route.

The upload form itself is the same for both: [`works.$workId.upload.$workVersionId`](../app/routes/app/works.$workId.upload.$workVersionId/route.tsx).

---

## New Work (My Works or Dashboard)

User is on **My Works** (`/app/works`) or the **Dashboard**. They click **Create new work** (My Works) or a task that starts new work (e.g. "Run Image Integrity Checks"). The app navigates to **`/app/works/new`** ([works.new](../app/routes/app/works.new/route.tsx)). That route’s loader fetches valid draft works via a shared helper. If drafts exist, the page shows **ResumeDraftWorkDialog**; if not, it submits `create-new-draft` to `/app/works` and shows "Creating new work…", then redirects to the upload route.

### Sequence diagram (New Work)

```mermaid
sequenceDiagram
  participant User
  participant Entry as My Works or Dashboard
  participant NewRoute as works.new
  participant Loader as getValidDraftWorksForUser
  participant Action as POST /app/works
  participant Upload as Upload route

  User->>Entry: Click "Create new work" or task
  Entry->>NewRoute: navigate(/app/works/new)
  NewRoute->>Loader: loader: get drafts
  Loader-->>NewRoute: drafts, canUpload

  alt drafts.length > 0
    NewRoute->>User: Show ResumeDraftWorkDialog
    User->>NewRoute: Resume or Create New or delete
    alt User: Resume
      NewRoute->>Upload: navigate(/app/works/:workId/upload/:workVersionId)
    else User: Create New
      NewRoute->>Action: POST intent=create-new-draft
      Action-->>NewRoute: { workId, workVersionId }
      NewRoute->>Upload: navigate(upload URL)
    end
  else drafts.length === 0
    NewRoute->>Action: POST intent=create-new-draft
    NewRoute->>User: Show "Creating new work…"
    Action-->>NewRoute: { workId, workVersionId }
    NewRoute->>Upload: navigate(upload URL)
  end
```

### Flow summary (New Work)

1. **Entry**  
   My Works **"Create new work"** button or dashboard task navigates to `/app/works/new`. No dialog or fetcher logic on My Works; the [works.new](../app/routes/app/works.new/route.tsx) route owns the flow.

2. **Loader**  
   [works.new loader](../app/routes/app/works.new/route.tsx) requires `app.works.upload`; calls [`getValidDraftWorksForUser`](../app/routes/app/works._index/getDrafts.server.ts) (uses `dbFindDraftFileWorksForUser` + `isValidDraftForReuse`). Returns `{ drafts, canUpload }`.

3. **Component**  
   If `drafts.length > 0`: render [ResumeDraftWorkDialog](../../../packages/scms-core/src/components/ui/dialogs/ResumeDraftWorkDialog.tsx) (fetch/delete post to `/app/works`). On resume → navigate to upload URL. On create new → submit `create-new-draft`, then navigate on success.  
   If no drafts: submit `create-new-draft` on mount, show centered "Creating new work…", then navigate when response returns.

4. **Create new work**  
   `create-new-draft` is handled by [works._index action](../app/routes/app/works._index/route.tsx) (`POST /app/works`). It calls [`dbCreateDraftFileWork`](../../../packages/scms-server/src/backend/db.server.ts). Response includes `workId` and `workVersionId`.

5. **Activity**  
   `dbCreateDraftWork` creates one activity with `ActivityType.NEW_WORK` in the same transaction as the work and first version.

---

## Create new version (Work Details)

User is on a **work’s details page** (`/app/works/:workId/details`). They click **Create new version**. The app checks whether the **latest version of this work** is already a draft (and valid for reuse). If yes, the resume dialog is shown; otherwise a new draft version is created and the user is sent to its upload page.

### Sequence diagram (Create new version)

```mermaid
sequenceDiagram
  participant User
  participant Details as Work Details page
  participant Action as works.$workId action
  participant DB as db.server (versions / delete)
  participant Server as scms-server dbCreateDraftWorkVersion
  participant Dialog as ResumeDraftWorkDialog
  participant Upload as Upload route

  User->>Details: Click "Create new version"
  Details->>Action: POST intent=get-drafts-for-work
  Action->>DB: dbGetWorkVersionsWithSubmissionVersions(workId)
  DB-->>Action: versions (newest first)
  Note over Action: If versions[0].draft && has 'checks' → 1 draft
  Action-->>Details: { drafts: [...] }

  alt drafts.length > 0
    Details->>Dialog: Open dialog (single draft = latest version)
    User->>Dialog: Choose "Resume" or "Upload New Version" or delete
    alt User: Resume
      Dialog->>Details: onResume(draft)
      Details->>Upload: navigate(.../upload/:workVersionId)
    else User: Create new version
      Dialog->>Details: onCreateNew()
      Details->>Action: POST intent=create-new-version
      Action->>Server: dbCreateDraftWorkVersion(ctx, workId, 'work-details')
      Server-->>Action: { workId, workVersionId }
      Action-->>Details: { success, workId, workVersionId }
      Details->>Upload: navigate(.../upload/:workVersionId)
    end
  else drafts.length === 0
    Details->>Action: POST intent=create-new-version
    Action->>Server: dbCreateDraftWorkVersion(ctx, workId, 'work-details')
    Server-->>Action: { workId, workVersionId }
    Action-->>Details: { success, workId, workVersionId }
    Details->>Upload: navigate(.../upload/:workVersionId)
  end
```

### Flow summary (Work Details)

1. **Button click**  
   [`handleUploadNewVersionClick`](../app/routes/app/works.$workId.details/route.tsx) submits `intent: 'get-drafts-for-work'` to the work route action (`/app/works/:workId`).

2. **Check for draft version**  
   Action handles `get-drafts-for-work`: loads versions with [`dbGetWorkVersionsWithSubmissionVersions`](../app/routes/app/works.$workId/db.server.ts). If the latest version is draft and [`isDraftVersionValidForReuse`](../app/routes/app/works.$workId/route.tsx) (has `checks` in metadata), returns that as a single-item `drafts` array; otherwise `drafts: []`.

3. **Client response**  
   In [`useEffect`](../app/routes/app/works.$workId.details/route.tsx): if `drafts.length > 0` → open [`ResumeDraftWorkDialog`](../../../packages/scms-core/src/components/ui/dialogs/ResumeDraftWorkDialog.tsx); else call `handleCreateNewVersion()`.

4. **Create new version**  
   `handleCreateNewVersion` submits `intent: 'create-new-version'`. Action (with upload scope) calls [`dbCreateDraftWorkVersion`](../../../packages/scms-server/src/backend/db.server.ts). Response includes `workId` and `workVersionId`.

5. **Redirect**  
   On success, another [`useEffect`](../app/routes/app/works.$workId.details/route.tsx) navigates to `/app/works/:workId/upload/:workVersionId` (or user resumes and navigates to the same pattern).

6. **Activity**  
   `dbCreateDraftWorkVersion` creates one activity with `ActivityType.WORK_VERSION_ADDED` in the same transaction.

7. **Delete draft (from dialog)**  
   If the user deletes the draft from the dialog, the action handles `delete-draft` (or `delete-all-drafts` with same intent) and calls [`dbDeleteDraftVersionOnWork`](../app/routes/app/works.$workId/db.server.ts), which removes the latest version only if it is a draft with no submission versions, and deletes its storage files.

---

## Code locations reference

Paths are relative to the repository root.

### New Work (entry: /app/works/new)

| Purpose | Location |
|--------|----------|
| New Work route: loader (drafts), dialog or "Creating new work…" then redirect | [works.new/route.tsx](../app/routes/app/works.new/route.tsx) |
| Shared get-drafts helper (valid draft works for user) | [works._index/getDrafts.server.ts](../app/routes/app/works._index/getDrafts.server.ts) |

### My Works (Create new work button)

| Purpose | Location |
|--------|----------|
| My Works page, "Create new work" button (navigates to /app/works/new), action intents | [works._index/route.tsx](../app/routes/app/works._index/route.tsx) |
| Fetch works list; delete draft work | [works._index/db.server.ts](../app/routes/app/works._index/db.server.ts) |
| Create new draft work + first version; create draft file work (with checks) | [scms-server db.server.ts](../../../packages/scms-server/src/backend/db.server.ts) (`dbCreateDraftWork`, `dbCreateDraftFileWork`) |

### Work Details (Create new version)

| Purpose | Location |
|--------|----------|
| Work details page, "Create new version" button, resume dialog wiring | [works.$workId.details/route.tsx](../app/routes/app/works.$workId.details/route.tsx) |
| Work route action: get-drafts-for-work, create-new-version, delete-draft | [works.$workId/route.tsx](../app/routes/app/works.$workId/route.tsx) |
| Get versions for work; delete draft version on work | [works.$workId/db.server.ts](../app/routes/app/works.$workId/db.server.ts) |
| Create new draft version on existing work | [scms-server db.server.ts](../../../packages/scms-server/src/backend/db.server.ts) (`dbCreateDraftWorkVersion`) |

### Shared

| Purpose | Location |
|--------|----------|
| Resume draft dialog (list drafts, resume / create new / delete) | [ResumeDraftWorkDialog.tsx](../../../packages/scms-core/src/components/ui/dialogs/ResumeDraftWorkDialog.tsx) |
| Upload form (redirect target for both flows) | [works.$workId.upload.$workVersionId/route.tsx](../app/routes/app/works.$workId.upload.$workVersionId/route.tsx) |

### Action intents (quick reference)

| Intent | Route | Purpose |
|--------|--------|--------|
| `get-drafts` | `POST /app/works` | List user’s draft works (My Works). |
| `create-new-draft` | `POST /app/works` | Create new work + first version (My Works). |
| `delete-draft` | `POST /app/works` | Delete a draft work (My Works). |
| `get-drafts-for-work` | `POST /app/works/:workId` | List draft versions for this work (at most latest). |
| `create-new-version` | `POST /app/works/:workId` | Create new draft version on this work. |
| `delete-draft` | `POST /app/works/:workId` | Delete latest draft version on this work (Work Details dialog). |
