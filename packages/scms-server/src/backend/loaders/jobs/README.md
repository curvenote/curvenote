# Loaders: jobs

This directory holds the **thin layer** used by API route loaders and actions: the top-level operations they need to call (read/update jobs, invoke work, counts, etc.).

It is **not** the home for job orchestration details. Dispatch (Pub/Sub, handshake, factories) and per–job-type **handlers** live under **`src/backend/jobs/`**, alongside other backend job logic. Think of this folder as the stable surface for route loaders and actions; think of `backend/jobs` as where behavior and wiring live.

The entry point is `index.ts`, which re-exports what the app should import from one place.
