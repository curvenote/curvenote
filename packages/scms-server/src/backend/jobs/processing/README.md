# Jobs: processing

Helpers that **enqueue work by publishing to Google Cloud Pub/Sub**. Downstream consumers are usually **Cloud Run** (or similar) services subscribed to the configured topics; they pull messages and run the actual processing.

These helpers are **typically invoked from job handlers** in [`../handlers`](../handlers) once a job row exists and the handler needs to hand work off to an external worker.

This is separate from **internal job dispatch**, which uses Vercel Queues (`enqueueAndDispatchJob` → `processJobMessage`). Processing here targets topic-specific pipelines (checks, converter, etc.).

Shared transport (attributes, optional JSON `data`, dev HTTP stubs vs real topics) lives in [`../pubsub.server.ts`](../pubsub.server.ts). This folder holds **per–job-type entrypoints** — [`startCheckProcessingService`](./startCheckService.server.ts) and [`startConverterService`](./startConverterService.ts) — that read app config, choose the right topic/credentials, and call into that layer.

In **development**, messages are POSTed to a local URL (`localhost:8080`) instead of Pub/Sub, matching the push shape workers expect.
