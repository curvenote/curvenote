# Submission tags filtering — Design Spec

**Status:** Approved  
**Issue:** [CN-2464](https://linear.app/curvenote/issue/CN-2464/phase-3-submission-tags-filtering)  
**Parent:** [CN-2415](https://linear.app/curvenote/issue/CN-2415/submission-tagging-and-filtering)  
**Depends on:** [CN-2451](https://linear.app/curvenote/issue/CN-2451) (phase 1: `Tag` model and assignments). Does **not** depend on [CN-2465](https://linear.app/curvenote/issue/CN-2465) catalog CRUD.  
**Module:** `ee/sites` submissions index (`$siteName.submissions._index`)

These are editorial tags (`Tag` / copy “Tags”), not version tags (`SiteWorkDTO.tags`).

## Summary

Anyone who can list submissions can filter the index by editorial tag. The toolbar gets a **Tags** multi-select chip that matches Kind / Collection: CSV of catalog **ids** in the URL, OR within the chip, AND with every other facet.

Theme Services and the public works listing are **not** this slice. Phase 1 already returns `SiteDTO.tags` and published `submission_tags` (`TagRefDTO`: `{ name, label }`). Public consumers keep filtering on `name` when that work is scheduled.

## Locked product decisions

| Topic | Decision |
| ----- | -------- |
| Surface | Admin submissions listing only. No Theme / `GET /v1/sites/:siteName/works` query param. |
| URL key | `tagIds` — catalog UUIDs, CSV, same contract as `kindIds` / `collectionIds`. Not `name`. |
| Why not `name` | `name` is the **published** key (`TagRefDTO`). This toolbar already speaks ids. Phase 2 froze `name` for themes, not for this admin listing. |
| Multi-select | **OR** (submission has **any** of the selected tags). |
| OR vs AND | OR matches Kind / Collection / Status (`IN`). AND is more useful for an M2M taxonomy and may be requested later. **Call this out on the PR** as a reversible decision; the URL does not need to change, only the predicate. |
| Other facets | AND with Kind, Collection, Status, dates, and `q`, as today. |
| Chip options | Every tag on the site (assigned or not), ordered by `label`. Display **label** (“Blog Post”), not `name`. |
| Empty catalog | Chip **stays visible and clickable**. Popover empty copy: `No tags yet`. Do not hide (Kind) and do not disable + tooltip. |
| One tag | Chip stays active. Unlike Kind, a single tag is still a useful filter (not every submission has it). |
| Row chips | Display only (phase 1). Click does not apply the filter. |
| Unknown ids | Leave `tagIds` in the URL. They match no extra rows. No 404, no toast. Same as Kind. |
| Permissions | Existing `site:submissions:list`. Do not require `site:tags:list`. No new scopes. |
| API / schema | No new `/v1` routes, no DTO changes, no migration. `TagsInSubmissions.tag_id` is already indexed. |

## Admin UI

**Route:** `/app/sites/:siteName/submissions`  
**Files:** `ee/sites/src/routes/$siteName.submissions._index/`

Toolbar row today:

`[Kind ▾] [Collection ▾] [Status ▾] [Published ▾]   Sort ▾`

Insert **Tags** after Collection and before Status:

`[Kind ▾] [Collection ▾] [Tags ▾] [Status ▾] [Published ▾]   Sort ▾`

### Chip

New `SubmissionsTagFilter`, a thin wrapper around `ListingMultiSelectChip` (same as Kind / Collection).

| Piece | Value |
| ----- | ----- |
| `paramKey` | `tagIds` |
| Trigger label | `Tags` |
| Option `id` | `Tag.id` |
| Option display | `Tag.label` (passed as the chip’s `name` field) |
| Search placeholder | `Search tags...` |
| No search matches | `No matching tags.` |
| Empty catalog | `No tags yet` |

Those last two copies must stay distinct. Today the chip has a single `noResultsLabel`. Extend it (or wrap it) so an empty `options` array shows the catalog-empty copy instead of the search-miss copy. Do not overload one string.

**Clear filters** already wipes the known listing keys; add `tagIds` to that set. Changing `tagIds` resets `page` to 1, via the existing `setListingParam` helpers.

### Empty catalog + stale URL

If the catalog is empty and the URL still has `tagIds` (tags deleted, or a hand-crafted link), the query still runs, the listing can be empty, and **Clear filters** removes `tagIds`. The chip does not open a selectable list.

## Data and query

### Chip options

`withAppSiteContext` loads the site through `dbGetSite`, which already includes `tags: { id, name, label }` ordered by `label`. Map that include in the index loader — same pattern as `ctx.site.submissionKinds` / `collections`.

Do **not** call `dbListSiteTagsForCatalog` (admin catalog + `date_created` + `site:tags.list`). Do not add a second tags query.

### `ListingQuery`

Add `tagIds: string[]`. Parse with the same CSV preprocessor as `kindIds`. Empty / missing → `[]` (no extra predicate).

### WHERE (both listing paths)

Tag filter does **not** force the raw-SQL path. Only `q` and `statuses` do that today. `tagIds` alone stays on the Prisma fast path.

**Prisma** (`buildListingPrismaWhere`):

```ts
tags: { some: { tag_id: { in: query.tagIds } } }
```

That is OR: a submission matches if it has at least one selected tag.

**Raw SQL** (`buildListingRawSqlWhere`):

```sql
EXISTS (
  SELECT 1 FROM "TagsInSubmissions" tis
  WHERE tis.submission_id = s.id
    AND tis.tag_id IN (...)
)
```

If AND is requested later, switch to one `some`/`EXISTS` per id combined with AND. Do not change `tagIds` encoding.

## Permissions and stacking

- Page loader stays `site:submissions:list`.
- Members who can list submissions see the chip, including an empty catalog.
- Catalog create / rename / delete remains [CN-2465](https://linear.app/curvenote/issue/CN-2465).
- This branch may stack on phase 2 until phase 1 lands on `dev`; product-wise the filter only needs the phase 1 model.

## Out of scope

- Theme Services / public works listing filter (confirm later; `name` is the key there)
- Click-to-filter from listing-row tag chips
- Changing OR to AND in this slice
- Catalog CRUD, assign/remove on details, CLI
- New analytics properties on `SITE_VIEWED`
- Author-facing listing, public theme UI

## Testing

**Unit (`listingParams`):**

- `tagIds` is a CSV param key
- Clear filters deletes `tagIds` and keeps `sort` / `perPage`
- `hasActiveListingFilters` is true when `tagIds` is set

**Unit (chip empty states, if extracted):**

- `options.length === 0` → `No tags yet`
- Non-empty options, no search hit → `No matching tags.`

**Integration (`submissions-index-search.spec.ts`):**

- `tagIds` with one id returns only submissions that have that tag
- Two ids → union (OR), not intersection
- `tagIds` AND `kindIds` narrows further
- Unknown id → no extra rows (and does not 500)
- `tagIds` without `q` / `statuses` still returns the correct set (Prisma fast path)
- Combined `q` + `tagIds` returns the intersection (raw SQL path)

Do not assert Tailwind / `cn()` class strings.

**Manual (browser, before done):**

- Chip lists all site tags by label; selecting one filters; two selected is OR
- Combine with Kind / search; Clear filters restores the full list
- Site with zero tags: chip visible, popover says `No tags yet`
- Listing-row tag chips do not change the URL
- Direct URL `?tagIds=<id>` is bookmarkable and resets `page` when toggled

## Key files

| Path | Role |
| ---- | ---- |
| `listingParams.ts` | `tagIds` on query, param key, clearable set |
| `route.tsx` | Zod schema, map `ctx.site.tags` into toolbar options |
| `SubmissionsListingToolbar.tsx` | Mount Tags between Collection and Status |
| `SubmissionsTagFilter.tsx` | New Kind-style wrapper |
| `ListingMultiSelectChip.tsx` | Distinct empty-catalog vs search-miss copy |
| `db.server.ts` | Prisma `some` + raw `EXISTS` |
| `listingParams.spec.ts` | URL helpers |
| `platform/scms/tests/integration/workflow/submissions-index-search.spec.ts` | Filter semantics |

## PR note (required)

Call out in the pull request body:

> Tag multi-select is **OR** (any selected tag), matching Kind / Collection / Status. AND (must have every selected tag) was considered and deferred. Revisit if editorial use needs intersection; the URL param can stay `tagIds`.

## Implementation notes (for the plan, not extra product)

- Follow Kind / Collection wrappers; do not invent a second chip system.
- Changeset on `@curvenote/scms-sites-ext` only unless a shared helper actually moves.
- No `@curvenote/common` DTO bump.
