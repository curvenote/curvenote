# deploy-curvenote (prebuilt Vercel deploy)

Production SCMS deploys from [deploy-curvenote](https://github.com/curvenote/deploy-curvenote) with:

| Setting | Value |
|---|---|
| Vercel Root Directory | `curvenote/platform/scms` |
| Submodule | `curvenote/` → this monorepo |
| Deploy method | Local prebuilt (`vercel build --prod` → `vercel --prebuilt --prod`) |

The queue push consumer lives **inside the submodule** at `platform/scms/api/job-queue-consumer.ts`, configured in `platform/scms/vercel.ts`. Because the submodule is checked out before `vercel build`, the `api/` file exists when Vercel validates `functions` patterns.

## Release steps

1. Merge queue consumer changes on `dev` in curvenote/curvenote.
2. In deploy-curvenote, bump the `curvenote` submodule pointer to that commit.
3. From deploy-curvenote root (with submodule updated): `make deploy` or `vercel build --prod && vercel --prebuilt --prod`.

## Do not

- Put `api/` at the deploy-curvenote repo root — it is outside the Vercel Root Directory and will not deploy.
- Use nested `api/v1/jobs/...` paths — use flat `api/job-queue-consumer.ts` only.
