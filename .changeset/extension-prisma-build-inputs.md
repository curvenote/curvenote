---
'@curvenote/scms-core': patch
---

Hash an extension package's `prisma/**` into its generated Turborepo build task, and treat `src/generated/**` as an output, so editing a schema reruns `prisma generate` instead of replaying a client built from an earlier one
