---
'@curvenote/scms-server': patch
---

Replace Pub/Sub job dispatch with a Vercel Queues pipeline: enqueue via `@vercel/queue`, consume through `api/job-queue-consumer.ts` (push trigger), and retire the Pub/Sub emulator tooling and dispatch routes.

Add job dependency handling with cancellation cascades through `onJobTerminal`, restore converter task timeline events, and surface converter outcomes in submission and work activity feeds.
