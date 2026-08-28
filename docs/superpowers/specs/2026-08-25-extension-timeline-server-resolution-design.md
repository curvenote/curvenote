# Extension timeline server resolution

**Date:** 2026-08-25  
**Status:** Implemented on `mnt/support-new-exts`

## Problem

Work-details timeline visibility for Foundry depended on shipping `metadata.foundry` through the host (`signVersionFilesForClient`). That put extension-named keys in the platform and confused `ctx` with platform `Context`.

## Decision

1. **Server owns visibility** via `ServerExtension.resolveTimelineItems` → `ExtensionTimelineItemDescriptor[]`.
2. **Client registers React only** via `getTimelineItems` (no `isVisible` required for work-details).
3. **Opaque `payload`** on descriptors / `ExtensionTimelineItemProps` for render hints (e.g. `{ canOpen }`).
4. **Naming:** `ExtensionTimelineItemProps` + `definition`/`props` — reserve `ctx` for platform `Context`.
5. **Host** calls `resolveExtensionTimelineDescriptors` and stops Foundry metadata passthrough.

## Data flow

```
works.$workId loader
  → resolveExtensionTimelineDescriptors(config, serverExtensions, { ctx, workVersions })
  → extensionTimelineDescriptors on loader data
  → versions[].metadata = signed files only

details timeline
  → getTimelineItems() definitions
  → buildExtensionTimelineEntriesForWorkVersion(…, descriptors)
  → ExtensionTimelineItemRenderer({ definition, props })
```

## Non-goals

- Submission-version surface
- First-class timeline DB table (checks already use `CheckServiceRun`)
