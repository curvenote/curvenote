# Submission tags — phase 1 (create, assign, display, API)

**Date:** 2026-08-27
**Linear:** [CN-2451](https://linear.app/curvenote/issue/CN-2451) (parent [CN-2415](https://linear.app/curvenote/issue/CN-2415))
**Status:** Approved, not implemented

## Problem

A site admin cannot classify a submission with editorial categories. Kind and
collection are single-valued and drive workflow, so they cannot carry free
editorial grouping such as "Blog Post" or "Editors Pick".

Phase 1 adds tags on a submission: a site-scoped catalog, assignment from the
site-admin submission details page, display on the details page and on the
submissions listing, and read access through two v1 endpoints.

## Naming

The feature is **tags** everywhere: table `Tag`, relation `Submission.tags`, UI
copy "Tags".

These editorial tags are **not** the existing version tags. Version tags are
`string[]` on `SubmissionVersion` and `WorkVersion`, and they are exposed as
`SiteWorkDTO.tags` (`v1`, `preprint`, …). Version tags do not change. Editorial
tags must never be written into `SiteWorkDTO.tags`.

The published payload therefore exposes editorial tags as `submission_tags`.

## Decisions

1. **Explicit join table** `TagsInSubmissions`, as with `KindsInCollections`
   and `CollectionsInForms`.
2. **Read and write helpers live in `@curvenote/scms-server`**
   (`loaders/sites/tags/`). The route action in `ee/sites` is a thin caller.
   The CLI work (CN-2437) reuses the same helpers.
3. **No new v1 write endpoints.** Create, assign and remove happen through the
   details-page `action`.
4. **`site:submissions:update` guards every mutation.** No new scope family.
5. **Orphan tags stay in the catalog.** Removing the last assignment does not
   delete the tag.
6. **Tag creation is idempotent.** The server derives `name` from `label`. If
   that `name` exists on the site, the server reuses that tag.
7. **Activity is recorded** with a new `ActivityType.SUBMISSION_TAGS_CHANGE`.
8. **One popover controls assignment and removal.** Chips have no remove
   button.

## Data

`prisma/schema/submission.prisma`:

```prisma
model Tag {
  id           String              @id
  name         String              // url-safe, lowercase, min 3 chars
  label        String              // human display string
  date_created String
  site         Site                @relation(fields: [site_id], references: [id])
  site_id      String
  submissions  TagsInSubmissions[]

  @@unique([name, site_id])
}

model TagsInSubmissions {
  id            String     @id
  date_created  String
  tag           Tag        @relation(fields: [tag_id], references: [id], onDelete: Cascade)
  tag_id        String
  submission    Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  submission_id String

  @@unique([submission_id, tag_id])
  @@index([tag_id])
}
```

`Submission` gets `tags TagsInSubmissions[]`. `Site` gets `tags Tag[]`.
`ActivityType` gets `SUBMISSION_TAGS_CHANGE`.

The join row has no `date_modified`, because nothing modifies it. The row is
created or deleted.

Create the migration with `bun run dev:db:migrate`, named `add_submission_tags`.

## Name derivation

`toTagName(label)` and `isValidTagName(name)` go into
`packages/scms-core/src/utils/`, beside `isSafeSlug`. The UI and the server
both import them.

Rules for `toTagName`:

- Trim, then lowercase.
- Replace whitespace runs with `-`.
- Keep `a-z`, `0-9`, `-` and `_`. Remove all other characters.
- Collapse repeated separators. Trim leading and trailing separators.

`isValidTagName` accepts a name of 3 characters or more that matches
`^[a-z0-9][a-z0-9_-]*$`. The UI blocks the create row when the derived name
fails this test.

## Server

New folder `packages/scms-server/src/backend/loaders/sites/tags/`:

- `format.server.ts` — `formatTagDTO(dbo): TagDTO`.
- `list.server.ts` — `dbListSiteTags(siteId)` and
  `dbListTagsForSubmission(submissionId)`. Both order by `label` ascending.
- `assign.server.ts` — `assignTagToSubmission(ctx, submissionId, input)` and
  `removeTagFromSubmission(ctx, submissionId, tagId)`.
- `index.ts` — namespace export, as in `collections/` and `kinds/`.

`assignTagToSubmission` accepts `{ tagId }` or `{ label }`. It runs in one
transaction:

1. For `{ label }`: derive `name`, then `upsert` on `@@unique([name, site_id])`.
   An existing tag is reused, never duplicated.
2. `upsert` the `TagsInSubmissions` row on `@@unique([submission_id, tag_id])`,
   so a repeated assignment is a no-op.
3. Write one `Activity` row: `activity_type: SUBMISSION_TAGS_CHANGE`,
   `submission_id`, `activity_by_id`, and
   `data: { tag: { id, name, label }, action: 'added' | 'removed' }`.

`removeTagFromSubmission` deletes the join row and writes the same activity
with `action: 'removed'`. It leaves the `Tag` row in place.

Both helpers verify that the tag and the submission belong to `ctx.site.id`.

## API

`packages/common/src/types/index.ts`:

```ts
export type TagDTO = { id: string; name: string; label: string };
```

`SiteDTO` gets `tags: TagDTO[]`. The field goes on `SiteDTO`, not on
`SiteConfig`, because `SiteConfig` is also the shape of the stored site
metadata.

**`GET /v1/sites/:siteName`** — `dbGetSite` includes `tags`. `formatSiteDTO`
maps them beside `collections`. The catalog is the tags of the site, whether
assigned or not.

`formatSiteDTO` also serves `GET /v1/sites`, so add `tags` to the default
`include` of `dbListMany` as well. `dbListMany` accepts a caller `include`, so
`formatSiteDTO` reads `dbo.tags ?? []`.

**`GET /v1/sites/:siteName/works/:workIdOrSlug/published`** —
`formatPublishedSiteWorkWithVersions` adds `submission_tags: TagDTO[]` with one
extra query keyed on `submission_id`, in the same way as `versions`:

```ts
export type PublishedSiteWorkDTO = ModifiedSiteWorkDTO & {
  versions: SiteWorkVersionDTO[];
  submission_tags: TagDTO[];
};
```

`formatSiteWorkDTO` and `siteWorkDtoSelect` do not change, so the listing
endpoints and every other consumer of `SiteWorkDTO` keep their current payload.
`SiteWorkDTO.tags` keeps carrying version tags.

Cache headers do not change.

## Admin UI

### Submission details

Route folder `ee/sites/src/routes/$siteName.submissions.$submissionId/`.

- `loader.server.ts` loads the site tag catalog and the tags of the submission,
  and adds both to `SubmissionDetailPageData`.
- `SubmissionDetails.tsx` gets a `DetailRow label="Tags"` between "Submission
  Kind" and "Slug".
- `SubmissionTags.tsx` renders the assigned tags as chips. With no tags it
  renders the empty-state trigger, as the other detail fields do.
- `TagPicker.tsx` renders the popover: `ui.Command` inside `PopoverWrapper`.

Popover behaviour:

- A click on any assigned chip opens the popover. A click on the "Add tags"
  trigger opens the same popover.
- The list shows the site catalog ordered by `label`, with a check mark on the
  assigned tags.
- A click on a row toggles it. A checked row unassigns. An unchecked row
  assigns. The popover stays open.
- The search input filters on `label` and on `name`.
- When the typed text matches no tag exactly, the last row offers
  `Create "<typed text>"`. That row is hidden when the derived name fails
  `isValidTagName`.
- Without `site:submissions:update` the chips render read-only and no trigger
  appears.

Mutations use a `fetcher` with optimistic state, as `useAttributeChangeDialog`
does for kind and collection. New `tags.server.ts` in the route folder holds
`actionAssignTag` and `actionRemoveTag`, validated with `zfd`, dispatched from
`route.tsx` on `formAction: 'tag-assign'` and `'tag-remove'`. The existing scope
check on the `action` already blocks unauthorised callers.

### Submissions listing

Route folder `ee/sites/src/routes/$siteName.submissions._index/`.

- Add `tags` to `INDEX_LISTING_SELECT`. The fast path and the search path share
  that constant, so both rows keep the same shape.
- Add `tags: TagDTO[]` to `IndexListingRow` and to `SubmissionsIndexItem`, and
  map them in `format.server.ts`.
- Add a `Tag` chip to `ee/sites/src/components/Chips.tsx`. `SubmissionsListItem`
  renders up to 3 chips and a `+N` chip for the rest, beside the collection and
  kind chips.

### Timeline and analytics

- `packages/scms-core/src/utils/activityLabels.ts` — label for
  `SUBMISSION_TAGS_CHANGE`.
- `SubmissionVersionTimeline.tsx` — render case that reads `activity.data`.
- `TrackEvent.SUBMISSION_TAGS_CHANGED` in
  `packages/scms-core/src/backend/services/analytics/events.ts`, sent from the
  route action.

## Tests

Unit:

- `toTagName` and `isValidTagName`: spaces, accents, symbols, short input.
- `formatTagDTO` and `formatSiteDTO`: the catalog is present and ordered.
- Picker utils: filtering, and when the create row appears.
- `assign.server`: reuses an existing name, is idempotent on repeated
  assignment, leaves the tag in the catalog after removal, and rejects a tag
  from another site.

Server:

- Extend `loaders/sites/submissions/published/get.server.test.ts` for
  `submission_tags`, and assert that `SiteWorkDTO.tags` still holds version tags
  only.

Close out with `bun run lint`, `bun --cwd platform/scms run check-types`, the
affected vitest suites, and a changeset.

## Out of scope

- Filtering by tag, in the admin listing or in Theme Services (phase 2).
- A tags management page, usage counts, rename and delete of catalog entries.
- Author-facing submission details (CN-2418).
- Public theme UI.
- The works listing endpoint.
- CLI flags (CN-2437).
