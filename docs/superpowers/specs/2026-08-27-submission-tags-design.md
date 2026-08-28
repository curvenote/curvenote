# Submission tags — phase 1 (create, assign, display, API)

**Date:** 2026-08-27
**Linear:** [CN-2451](https://linear.app/curvenote/issue/CN-2451) (parent [CN-2415](https://linear.app/curvenote/issue/CN-2415))
**Status:** Implemented

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
   button. Unassign from the catalog list inside the popover.
9. **Listing is display-only.** No picker, no add button, no remove `x` on
   listing chips. Create, assign and remove stay on the details page.
10. **Listing tags get their own row** under the dates, not mixed with
    collection / kind / published / DOI. No tags means no row.
11. **Empty details never say `Not assigned`.** The empty state is always
    the `+ Add Tags` control: enabled with update permission, disabled
    without it.
12. **The compact `+` is only for editors.** Without update permission it
    does not render, even when tags are assigned.
13. **Copy is English `Tags` / `Add Tags`.** No Spanish UI strings.

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

Two admins can type the same new label at the same time. The `upsert` in step 1
then raises `P2002` for the slower request. `assignTagToSubmission` catches
`P2002` on `Tag`, reads the tag by `name` and `site_id`, and continues. Without
that catch, decision 6 hides a 500.

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

**`GET /v1/sites/:siteName/works/:workIdOrSlug/published`** — only this endpoint
gains the field:

```ts
export type PublishedSiteWorkWithTagsDTO = PublishedSiteWorkDTO & {
  submission_tags: TagDTO[];
};
```

`formatPublishedSiteWorkWithVersions` must **not** change. The DOI endpoints
(`loaders/sites/doi.server.ts` and `loaders/doi/resolve.server.ts`) call it, and
`docs/planning/site-doi-resolve-performance.md` tunes that path. A new query
there would cost a round trip on the DOI path and widen its payload beyond this
issue.

Instead, add a published-only select and map the field in the default export of
`published/get.server.ts`, which only the `/published` route calls:

```ts
export const publishedSiteWorkWithTagsSelect = {
  ...siteWorkDtoSelect,
  submission: {
    select: {
      ...siteWorkSubmissionSelect,
      tags: { select: { tag: { select: { id: true, name: true, label: true } } } },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;
```

The row is a structural superset of `SiteWorkDtoInput`, so
`formatPublishedSiteWorkWithVersions` still accepts it. There is no second round
trip.

`formatSiteWorkDTO`, `siteWorkDtoSelect` and `siteWorkSubmissionSelect` do not
change, so the listing endpoints, the DOI endpoints and every other consumer of
`SiteWorkDTO` keep their current payload. `SiteWorkDTO.tags` keeps carrying
version tags.

Cache headers do not change. `SEMI_STATIC_BURST_PROTECTION` is 10 s in the
browser and 60 s on the CDN, so a new tag shows up within a minute. No purge
step is needed.

## Admin UI

### Submission details

Route folder `ee/sites/src/routes/$siteName.submissions.$submissionId/`.

- `loader.server.ts` loads the site tag catalog and the tags of the submission,
  and adds both to `SubmissionDetailPageData`.
- `SubmissionDetails.tsx` gets a `DetailRow label="Tags"` between "Submission
  Kind" and "Slug".
- `SubmissionTags.tsx` renders assigned tags as chips and chooses the add
  control (`add-tags` / `plus` / `none`) in `SubmissionTags.utils.ts`.
- `emptyDetailValue()` (`Not assigned`) is not used for tags.
- `TagPicker.tsx` renders the popover: `ui.Command` inside `PopoverWrapper`.
  Its trigger is the child passed in.

| Permission | Assigned tags | What renders |
| --- | --- | --- |
| Update | None | Enabled `+ Add Tags`. It is the `TagPicker` trigger. |
| Update | One or more | Assigned chips, then an enabled compact `+` to the right. Chips and `+` open the same `TagPicker`. |
| No update | None | The same `+ Add Tags` button, **disabled**. No popover. |
| No update | One or more | Assigned chips, read-only. **No `+`.** Chips do not open the picker. |

The add control sits in the same wrap row as the chips. With update
permission it is also disabled while the fetcher is not idle.

Popover behaviour:

- With update permission, a click on any assigned chip or on the add
  control opens the same popover.
- The list shows the site catalog ordered by `label`, with a check mark on the
  assigned tags.
- A click on a row toggles it. A checked row unassigns. An unchecked row
  assigns. The popover stays open.
- The search input filters on `label` and on `name`.
- When the typed text matches no tag exactly, the last row offers
  `Create "<typed text>"`. That row is hidden when the derived name fails
  `isValidTagName`.

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
- `INDEX_LISTING_SELECT` then holds both meanings of the word: `versions[].tags`
  are version tags, which feed `pickVersionTag` and `versionTag`, and the new
  submission-level `tags` are the editorial tags. Comment both lines at the
  select, because `format.server.ts` is where the two can get mixed up.
- Add `Tag` and `TagOverflow` chips to `ee/sites/src/components/Chips.tsx`,
  muted grey outline so they do not look like collection / kind chips. Put
  the classes on the chip component. Do not return class names from a helper.
- `SubmissionsListItem` does not render editorial tags in the collection /
  kind / published / DOI row.
- When `item.tags.length > 0`, `SubmissionListingTags` renders a row below
  `SubmissionListingDates`: a tag icon, up to 3 pills (`label`, `title` =
  `name`), and a `+N` pill when there are more than 3, with overflow labels
  in `title`.
- When `item.tags.length === 0`, render nothing. Do not show `Add Tags` or
  `Not assigned` on the listing.

### Timeline and analytics

- `packages/scms-core/src/utils/activityLabels.ts` — label for
  `SUBMISSION_TAGS_CHANGE`.
- `SubmissionVersionTimeline.tsx` — render case that reads `activity.data`.
- `TrackEvent.SUBMISSION_TAGS_CHANGED` in
  `packages/scms-core/src/backend/services/analytics/events.ts`, sent from the
  route action.

## Testing

Every slice is written test-first: a failing test, then the code that makes it
pass, then the clean-up. The slices are data, server helpers, API, and UI.

### Before the first test

This worktree has no `node_modules`. Run `bun run install:workspace` and
`bun run build:scms` once. Integration and e2e tests need the local database:
`bun run dx:up`, then `bun --cwd platform/scms run test:db:reset`.

`ee/sites` (`@curvenote/scms-sites-ext`) has `vitest` as a dependency but no
`test` script, so CI (`bun run test` → turbo) never runs the `.spec.ts` files
that already live there. Add `"test": "vitest run"` to that package and confirm
the existing specs pass. Without that step, the UI-side specs below are dead
code.

### Layer 1 — pure units (colocated `*.spec.ts`)

Run with each package's own `vitest run`.

- `packages/scms-core/src/utils/tagName.spec.ts` — `toTagName` for spaces,
  accents, symbols, mixed case, repeated separators; `isValidTagName` for input
  under 3 characters and for a leading separator.
- `packages/scms-server/.../tags/format.server.spec.ts` — `formatTagDTO` returns
  `{ id, name, label }` and nothing else.
- `packages/scms-server/.../sites/get.server.test.ts` — `formatSiteDTO` maps the
  catalog, orders it by `label`, and returns `[]` when the caller `include`
  omits `tags`.
- `ee/sites/.../$submissionId/TagPicker.utils.spec.ts` — filtering on `label`
  and on `name`, when the `Create "…"` row appears, and that it stays hidden for
  an invalid derived name. UI logic goes in `*.utils.ts` so it is testable, as
  `SlugManagerDialog.utils.ts` already does.
- `ee/sites/.../$submissionId/SubmissionTags.utils.spec.ts` — which add
  control to show (`add-tags` / `plus` / `none`) for each permission ×
  empty/assigned combination.
- `ee/sites/.../_index/format.server.spec.ts` — the listing item carries
  editorial tags and keeps `versionTag` from the version tags.
- `ee/sites/.../_index/SubmissionListingTags.utils.spec.ts` — split visible
  vs overflow tags and the overflow `title` string.

### Layer 2 — published payload (mocked prisma)

- Extend `loaders/sites/submissions/published/get.server.test.ts`:
  `submission_tags` is present, and `SiteWorkDTO.tags` still holds version tags
  only.
- Assert the DOI path keeps its payload: `formatPublishedSiteWorkWithVersions`
  returns no `submission_tags`.

### Layer 3 — integration, real database

New `platform/scms/tests/integration/workflow/submission-tags.spec.ts`, built on
`createTestData` as `submission-actions.spec.ts` does. Mocked prisma cannot
prove a unique constraint or a transaction, so these cases belong here:

- Creating from a label derives the name and writes one `Tag` row.
- A second create with the same derived name reuses the row; it does not
  duplicate.
- A `P2002` on `Tag` is recovered, not raised.
- A repeated assignment is a no-op, not a duplicate join row.
- Removal deletes the join row and leaves the tag in the catalog.
- A tag from another site is rejected.
- Each mutation writes one `SUBMISSION_TAGS_CHANGE` activity with the tag in
  `data`.

### Layer 4 — API end to end

Add tags to the seed fixtures in `prisma/data.test/science.json`, then:

- `tests/e2e/sites.public.spec.ts` — `GET sites/science` returns the catalog.
- A new `tests/e2e/sites.tags.spec.ts` — `GET sites/science/works/CRV0001/published`
  returns `submission_tags`, and `tags` still holds version tags.
- `tests/e2e/sites.doi.spec.ts` — the DOI response has no `submission_tags`.

### Not covered by tests

The repo has no React component test setup (`@testing-library/react` is absent).
The popover interaction itself is checked by hand in the app. Everything in it
that can be a pure function is a pure function, and Layer 1 covers those.
Also check by hand: listing with and without tags; details empty (`Add Tags`
enabled vs disabled); details with tags (`+` present vs hidden).

### Close out

`bun run lint`, `bun --cwd platform/scms run check-types`,
`bun run test`, `bun --cwd platform/scms run test:unit`,
`bun --cwd platform/scms run test:integration`, and a changeset.

## Out of scope

- Assign or remove from the listing.
- Filtering by tag, in the admin listing or in Theme Services (phase 2).
- A tags management page, usage counts, rename and delete of catalog entries.
- Author-facing submission details (CN-2418).
- Public theme UI.
- The works listing endpoint.
- CLI flags (CN-2437).
