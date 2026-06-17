---
'@curvenote/scms-core': minor
---

Add check service maintenance mode. Admins can toggle a per-service maintenance state (stored on the extension config Object row) that blocks outbound check actions and new job starts while leaving webhooks and in-flight jobs running. Provides shared building blocks: maintenance types/parsers, server guards, a `CheckMaintenanceProvider` with `useCheckMaintenanceBlocked`/`useAnyCheckMaintenanceBlocked` hooks, a `CheckMaintenanceAdminPanel`, and a `MaintenanceTooltip` that surfaces over disabled controls.

On the work upload flow, a selected check whose service is under maintenance no longer blocks submission: it is skipped (not initiated) and the work is created as though it was never selected, with an informational note shown next to Continue.
