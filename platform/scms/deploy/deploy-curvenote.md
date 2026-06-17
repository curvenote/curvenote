# deploy-curvenote (prebuilt Vercel deploy)

Production SCMS deploys from [deploy-curvenote](https://github.com/curvenote/deploy-curvenote) with:

| Setting | Value |
|---|---|
| Vercel Root Directory | `curvenote/platform/scms` |
| Submodule | `curvenote/` → this monorepo |
| Deploy method | Local prebuilt (`vercel build --prod` → `vercel --prebuilt --prod`) |

Job dispatch uses **Supabase pgmq** (not a separate queue service). Messages are stored in Postgres; the app wakes **`POST /v1/jobs/push-to-drain`** after enqueue. `vercel.ts` sets `maxDuration` for that route.

## Release steps

1. Merge job queue changes on `dev` in curvenote/curvenote.
2. Ensure the **pgmq migration** has run on staging/prod (`prisma migrate deploy` via CI on push to `dev` / `main`).
3. Populate **`_JobQueueDrainConfig`** on each database (once per env) with the SCMS base URL and `api.queueConsumerSecret` — see `platform/scms/README.md`.
4. In deploy-curvenote, bump the `curvenote` submodule pointer to that commit.
5. From deploy-curvenote root (with submodule updated): `make deploy` or `vercel build --prod && vercel --prebuilt --prod`.

## Do not

- Deploy app code that sets `QUEUES_PROVIDER=supabase` before the pgmq migration has run on that database.
- Rely on pg_cron alone — self-HTTP wake on enqueue is the primary drain path; cron is backup only.
