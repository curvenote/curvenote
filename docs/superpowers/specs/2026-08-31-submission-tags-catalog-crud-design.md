# Submission tags catalog CRUD — Design Spec

**Status:** Approved  
**Issue:** [CN-2465](https://linear.app/curvenote/issue/CN-2465/phase-2-submission-tags-catalog-crud-view-create-edit-delete)  
**Parent:** [CN-2415](https://linear.app/curvenote/issue/CN-2415/submission-tagging-and-filtering)  
**Depends on:** [CN-2451](https://linear.app/curvenote/issue/CN-2451) (phase 1, in review). This branch stays stacked on phase 1 until that lands on `dev`.  
**Module:** `ee/sites` (site admin) + `packages/scms-server` tag loaders + `packages/scms-core` scopes

These are editorial tags (`Tag` / copy “Tags”), not version tags (`SiteWorkDTO.tags`).

## Summary

Site admins get a **Tags** catalog page: a table of every tag on the current site, with create, rename of the display label, and delete. Phase 1 can already create a tag in place while assigning it to a submission. It cannot list, rename, or delete the catalog.

Writes stay **in the admin app** (form POST to the page), same as Kinds and Collections. There is no new public `/v1` write API. Phase 1 already exposes the catalog for **read** on `GET /v1/sites/:siteName` (`SiteDTO.tags`) and assigned tags on the published work as `submission_tags`.

## Locked product decisions

| Topic | Decision |
| ----- | -------- |
| Edit | Change **label** only. **`name` is read-only** after create. A new public slug means create a new tag (and delete the old one if needed). |
| Delete when in use | Always allowed. Join rows cascade off. Confirm dialog; no usage counts in the table. |
| Permissions | New `site:tags.*` family. **Site `ADMIN` only** for the catalog page. Phase 1 picker is unchanged (`site:submissions:update` may still create-on-assign). |
| Activity | Catalog create / edit / delete writes **no** `SUBMISSION_TAGS_CHANGE`, no per-submission fan-out, no `Submission.date_modified` bump. |
| Create/edit chrome | **Dialogs** (not the expandable Kind form). Table + dialogs is the direction Kind/Collection should move toward. |
| Writes | App route only. No public write “mailbox”. |

`name` is the public key phase 1 already documented on `TagRefDTO`. Re-deriving it on rename would break themes and later filters that stored `blog-post`. Leaving it editable with a warning still rewrites the key. Freezing it, and creating a new tag when the slug must change, keeps that key stable.

## Admin UI

**Route:** `/app/sites/:siteName/tags`  
**File:** `ee/sites/src/routes/$siteName.tags/` (same route-folder pattern as `$siteName.kinds`).

**Sidebar:** Administration, next to Submission Kinds and Collections.

```ts
{
  name: 'admin.tags',
  label: 'Tags',
  url: `${baseUrl}/tags`,
  scope: scopes.site.tags.list,
}
```

**Page chrome:** `PageFrame` with breadcrumbs `Sites → [site title] → Tags`, title **Tags**, subtitle like `Editorial tags for submissions on ${siteTitle}`.

**Primary action:** **Add Tag** (`ui.Button` + `PlusCircle`, same visual as Add Kind). Opens the create dialog; it does not expand an inline form.

### Table

Domains-style table inside a lifted `primitives.Card` (not Kind cards). Columns:

| Column | Content |
| ------ | ------- |
| Label | Phase 1 solid **neutral** chip (the display string) |
| Name | `name` in mono, not editable |
| Created | `Tag.date_created`, formatted with the same date helper other site-admin lists use |
| Actions | Edit (pencil) and Delete (trash) |

Sort: by `label` ascending, same as `dbListSiteTags` today.

**Empty:** Keep header row. Body copy: `No tags yet. Add a tag to use it on submissions.`

No search, no “in use” count, no color, no groups.

### Create dialog

- Title: **New tag**
- Field: **Label** (required, 1–32 chars, same bounds as phase 1)
- Live read-only preview: derived `name` via `toTagName` / `isValidTagName`
- Actions: Cancel, **Create tag**
- Does **not** assign the tag to any submission

If the derived `name` already exists on the site → field error (do not reuse silently). The picker reuses on assign; this dialog is an explicit create.

### Edit dialog

- Title: **Edit tag** (or the current label)
- Field: **Label** only
- `name` shown read-only, not an input
- Save updates `label`. `id` and `name` stay as they are

Two tags may share a display label after an edit. Uniqueness remains on `name` per site only. Do not add a label unique constraint.

### Delete dialog

Use `ui.Dialog` like `ConfirmSlugActionDialog` (not `window.confirm`). Destructive confirm control uses the same soft-destructive button classes as slug remove.

Copy must say:

- The tag is removed from the catalog
- It is removed from **every** submission that had it
- This cannot be undone

Do not list submissions or show a count. Deleting a tag that is on zero submissions still uses this copy (the “every submission” sentence is still true).

### Dialog vs picker

The details-page picker is unchanged: create-on-assign, unassign, no catalog management. An open details tab does not live-sync; a reload/revalidation shows the new label or a missing chip.

## Permissions

Add to `packages/scms-core/src/scopes.ts` only (`packages/blocks` scopes are a different system):

```ts
tags: {
  list: 'site:tags:list',
  read: 'site:tags:read',
  create: 'site:tags:create',
  update: 'site:tags:update',
  delete: 'site:tags:delete',
}
```

`read` exists for family parity with kinds/collections. The page loader requires `list`. Mutations require `create` / `update` / `delete` respectively.

**Role map** (`packages/scms-server/src/backend/roles.server.ts`):

- `SiteRole.ADMIN`: all five tags scopes (alongside kinds)
- `MEMBER`, `SUBMITTER`, `PUBLIC`, `UNRESTRICTED`: **none**

This is stricter than Kinds (`MEMBER` can `kinds.list` / `kinds.read`). The ticket is site-admin only; a read-only catalog for members is out of scope.

`system:admin` continues to pass site scope checks as it does today.

Phase 1: `assignTagToSubmission` / `removeTagFromSubmission` still gated by `site:submissions:update` on the details action. Creating a catalog row as a side effect of assign does **not** require `site:tags:create`.

Direct URL `/tags` without `site:tags:list` → same redirect/403 pattern as other admin catalog pages (`withAppSiteContext`).

## Data

Reuse `Tag` and `TagsInSubmissions`. No new model, no migration.

```
Tag { id, name, label, date_created, site_id }
TagsInSubmissions.tag_id  ON DELETE CASCADE
```

| Action | Effect |
| ------ | ------ |
| Create | Insert `Tag`. Derive `name` with `toTagName`. Validate with `isValidTagLabel` / `isValidTagName`. Unique `(name, site_id)`: on P2002 return 400 “already exists”, do not return the existing row. |
| Update | `UPDATE Tag SET label = …` where `id` + `site_id`. Never write `name`. Missing row → 404. |
| Delete | `DELETE Tag` where `id` + `site_id`. Join rows go with it. Missing row → 404. |

Do **not**:

- Write `ActivityType.SUBMISSION_TAGS_CHANGE`
- Insert new `TAG_*` activity types
- Bump `Submission.date_modified`
- Fire `TrackEvent.SUBMISSION_TAGS_CHANGED` (that event is for assign/remove on a submission)

Published JSON shape is unchanged. The next `GET` after an edit shows the new `label`; after a delete the tag is absent from `SiteDTO.tags` and from `submission_tags` on affected works.

### DTOs

`TagDTO` / `TagRefDTO` stay `{ id, name, label }` and `{ name, label }`. Do **not** add `date_created` to those types (it would leak onto `SiteDTO.tags` for no consumer). The catalog page loader selects `date_created` into a **page-local** row type.

`dbListSiteTags` today selects `{ id, name, label }`. Add `date_created` only for the catalog list helper (new function or optional select), not for the picker/site DTO path unless that path already ignores extra fields — keep the picker select as it is.

## Server wiring

Tag mutations live next to phase 1:

`packages/scms-server/src/backend/loaders/sites/tags/`

- Keep `list.server.ts`, `assign.server.ts`, `format.server.ts`
- Add create / update / delete helpers (same package, same validation functions)

The tags **page** `action` in `ee/sites` parses `intent` (`create-tag` / `update-tag` / `delete-tag`), checks the matching `site:tags.*` scope, and calls those helpers.

No `platform/scms/app/routes/api/v1.sites.$siteName.tags*.tsx` write routes.

## Errors (surfaced in the open dialog)

| Case | Result |
| ---- | ------ |
| Empty / too-long label | 400, message on the label field |
| Derived name invalid (`toTagName` too short, etc.) | 400, same as the picker |
| Create with existing `name` | 400, already exists |
| Edit/delete unknown or other-site id | 404 |
| Scope missing on action | 403 |

## Out of scope

- Filtering submissions or Theme Services by tag — [CN-2464](https://linear.app/curvenote/issue/CN-2464)
- Changing `name` on an existing row
- Usage counts, colors, icons, groups, search/filter on the table
- Public write API, CLI (`CN-2437`)
- Author-facing UI, public theme UI
- Merge / archive (Linear has these; we only delete)
- Live sync between the catalog and an open submission details tab

## Testing

**Unit / loader (CI):**

- Create derives `name`, rejects invalid label/name, rejects duplicate `name`
- Update changes `label` only; `name` unchanged
- Delete removes `Tag` and `TagsInSubmissions`; other tags on the same submission remain
- Helpers refuse the wrong `site_id`
- Scope map: `ADMIN` has `site:tags.*`; `MEMBER` / `SUBMITTER` do not
- Menu includes Tags only when `site:tags:list` is present
- Dialog copy helpers and name-preview helper tested like `TagPicker.utils`

**Manual (browser, before done):**

- Add Tag from the empty state; row appears with chip, name, created date
- Edit label; name column unchanged; details-page chip text updates after reload
- Delete a tag that is on a submission; chip gone on details and listing
- User without admin role: no sidebar item; `/tags` rejected
- Picker still creates-on-assign without `site:tags:create`

## Implementation notes (for the plan, not extra product)

- Stack on phase 1 until CN-2451 merges; then rebase onto `dev`.
- Follow `ee/sites` catalog pages for `PageFrame`, breadcrumbs, `withAppSiteContext`.
- Follow `ConfirmSlugActionDialog` for dialog structure and destructive confirm.
- Follow phase 1 `toTagName` / length bounds; do not invent a second naming scheme.
- Changeset on `@curvenote/scms-sites-ext`, `@curvenote/scms-server`, `@curvenote/scms-core` (scopes). Bump `@curvenote/common` only if a DTO actually changes (it should not).
