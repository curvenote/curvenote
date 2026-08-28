# Submission Details MEDIA Section — Design Spec

**Status:** Approved  
**Branch:** `feat/sub-det-media`  
**Module:** `ee/sites` (site-admin submission details)

## Summary

Add a read-only **MEDIA** section on the site-admin submission details page that shows the active work version’s thumbnail as a single ChooseThumbnail-style tile. If no thumbnail is available, show a same-sized placeholder with muted centered “No Thumbnail” text.

This restores the thumbnail that was removed when the Social Media Card was replaced by `SubmissionSummaryCard` (PR #1063), without bringing back the old social-card layout.

## Placement

On `$siteName.submissions.$submissionId` (`route.tsx`), insert the section **between** `SubmissionSummaryCard` and `SubmissionDetails`:

1. Summary card  
2. **MEDIA** (new)  
3. Submission Details  
4. Access Links  
5. Timeline  

## Component

**File:** `ee/sites/src/routes/$siteName.submissions.$submissionId/SubmissionMediaSection.tsx`

Presentational component owned by the sites route (not extracted into `scms-core`).

**Props:**

| Prop | Type | Purpose |
| ---- | ---- | ------- |
| `thumbnailUrl` | `string \| undefined` | Signed thumbnail URL, or missing |
| `title` | `string` | Used as image `alt` |

## Data

- Source: `activeVersion.site_work.links.thumbnail`
- Already produced by `detail.format.server.ts` via `signPrivateUrls` when the work version has `cdn` + `cdn_key` (same path as the removed Social Media Card thumbnail).
- No loader or API changes.
- Display-only: no edit, select, or upload actions.

## Visual design

### Section chrome

Match the Submission Details section label:

- Text: `MEDIA`
- Classes: `text-xs font-medium tracking-wider uppercase text-muted-foreground`

Do **not** use `SectionWithHeading` / lucide icons for this section (keeps parity with the refreshed details heading style).

### Thumbnail tile (present)

Borrow look/feel from `ChooseThumbnailSection`’s display tile (not the interactive button chrome):

- Outer width constrained to one gallery column (same responsive width pattern as ChooseThumbnail row tiles: ~half width on small screens through ~1/5 on large), so the tile does not stretch full page width.
- Card: `rounded-md border border-stone-200 bg-white` plus ChooseThumbnail dark equivalents (`dark:border-stone-500 dark:bg-stone-900`).
- Padding and stack: small muted label **Thumbnail** above a square image area.
- Image area: `aspect-square`, muted stone background, image `object-contain w-full h-full`.
- Not a `<button>`; no selection ring, checkmark, or “Current” label.

### Empty state (no thumbnail URL)

- Same outer dimensions and card structure as the present tile.
- Square area contains centered muted text: **No Thumbnail**.
- No image element.

## Out of scope

- Editing or regenerating thumbnails
- Figures / equations galleries
- Extracting a shared read-only tile into `scms-core`
- Changes to platform SCMS (author) upload or works routes

## Testing

- Optional light unit test for `SubmissionMediaSection`: renders image when URL present; renders “No Thumbnail” when absent.
- Manual check on a submission with and without a thumbnail.

## Key files

| Path | Role |
| ---- | ---- |
| `ee/sites/.../SubmissionMediaSection.tsx` | New MEDIA section UI |
| `ee/sites/.../route.tsx` | Mount between summary and details |
| `ee/sites/.../detail.format.server.ts` | Existing thumbnail signing (unchanged) |
| `packages/scms-core/.../ChooseThumbnailSection.tsx` | Visual reference only |

## References

- Removed thumbnail: `primitives.Thumbnail` + `activeVersion.site_work.links.thumbnail` in pre-#1063 `route.tsx`
- Visual reference: ChooseThumbnail gallery tiles (square, bordered, labeled)
