---
'@curvenote/scms-server': patch
---

Add generic check-run Slack event types (`CHECK_RUN_STARTED`, `CHECK_RUN_MILESTONE`, `CHECK_RUN_ERROR`, `CHECK_RUN_RETRY`, `CHECK_EULA_ACCEPTED`) so extension check packages can emit operational notifications on the existing `api.slack.webhookUrl` channel. Document the new events in the Slack integration guide; check-specific deep links remain in extension packages (e.g. `@hhmi/checks-notify`), not in core.
