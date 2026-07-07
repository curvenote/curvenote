# Curvenote monorepo — agent instructions

## Cursor Cloud specific instructions

Cloud environment configuration is **not committed** to this public repo. See [.cursor/README.md](.cursor/README.md).

Use the [Cursor Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments) for install commands, secrets, terminals, and snapshots. The generic bootstrap script is [`scripts/cloud-setup.sh`](scripts/cloud-setup.sh).

Optional local overlay (gitignored): copy `*.example.json` / `*.example` files under `.cursor/` and `scripts/cloud/`.

### After cloud install

```bash
npm run build:scms
```

### Running tests

```bash
npm run test:scms
npm run test
```

### SCMS dev server

```bash
cd platform/scms && npm run dev
```

Port **3031**.

### Database

Postgres via [`docker-compose.yml`](docker-compose.yml):

```bash
npm run db:up
npm run dev:db:reset   # migrations + seed
npm run dev:db:migrate
```

### Worktrees (local)

```bash
npm run wt:create -- <branch-name>
```

Copies local secrets from the main checkout. Extension clones use `WORKTREE_EXTENSIONS=<env>` with a local `scripts/extensions.manifest.json` — see `.cursor/README.md`.

### Lint (scoped)

```bash
npm run lint --workspace @curvenote/scms
npm run lint:format:fix --workspace @curvenote/scms
```
