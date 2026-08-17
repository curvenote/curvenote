---
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
'@curvenote/scms-db': patch
'@curvenote/scms-tasks': patch
'@curvenote/scms': patch
'@curvenote/cli': patch
'curvenote': patch
---

Coordinate dependency security and alignment updates across SCMS and CLI:

- Pin transitive security overrides (undici, body-parser, fast-uri, ip-address, and related)
- Bump mermaid / DOMPurify and Prisma 7.9.1 (+ Hono node-server floor)
- Upgrade CLI `jsonwebtoken` to v9
- Unify `react-router` / `@react-router/*` on 7.18.2
- Align vitest v4 and dotenv v17 holdouts
