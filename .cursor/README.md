# Cursor Cloud (private setup)

This public repo intentionally does **not** commit Cursor Cloud environment configuration. Keep team-specific setup out of git.

## Recommended: dashboard-only environments

Create saved environments at [Cloud Agents → Environments](https://cursor.com/dashboard/cloud-agents#environments). Cursor resolves config in this order:

1. `.cursor/environment.json` in the repo (if present — **do not commit** yours)
2. Your **personal** saved environment
3. Your **team** saved environment

If you skip (1), steps (2–3) are enough. Nothing sensitive needs to live in the public repo.

Configure in the dashboard:

- **Install command** — e.g. `CLOUD_ENV=your-env-name bash scripts/cloud-setup.sh`
- **Start** — `sudo service docker start`
- **Terminals** — dev servers (`platform/scms`, etc.)
- **Runtime Secrets** — env vars mapped by your local `scripts/cloud/secrets.manifest.json`
- **Snapshot** — after first successful setup

## Optional: local gitignored overlay

Copy examples and edit locally (never commit):

```bash
cp .cursor/environment.json.example .cursor/environment.json
cp .cursor/Dockerfile.example .cursor/Dockerfile
cp scripts/extensions.manifest.example.json scripts/extensions.manifest.json
cp scripts/cloud/secrets.manifest.example.json scripts/cloud/secrets.manifest.json
```

Add extra environments, extension repos, secret mappings, and `repositoryDependencies` in those gitignored files only.

For multiple environments (e.g. SCMS vs full workspace), use separate dashboard saved environments with different `CLOUD_ENV` values and environment-scoped secrets.

## Bootstrap script (committed, generic)

[`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) is OSS-safe: it reads **gitignored** manifests if present, runs `npm install`, `npm run db:up`, and `npm run dev:db:reset` on first boot.

## My Machines

Run agents on your laptop with existing secrets and clones:

```bash
agent worker start --name my-dev --worker-dir /path/to/curvenote
```

## Docs

- [Cursor Cloud setup](https://cursor.com/docs/cloud-agent/setup)
- [Secrets](https://cursor.com/docs/cloud-agent/security-network#secret-protection)
