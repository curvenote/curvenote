# Optional: SCMS MCP server

The [SCMS Content MCP](https://github.com/curvenote/mcp) is an optional workspace package cloned into `platform/mcp`, similar to extension repos under `extensions/`. It is not committed to this monorepo.

## Setup

From the repository root:

```bash
git clone git@github.com:curvenote/mcp.git platform/mcp
npm install
```

When `platform/mcp/package.json` exists, `npm install` links `@curvenote/scms-mcp` via the root `platform/*` workspace glob. Postinstall generates Turborepo task overrides for the gitignored sources.

## Worktrees

`npm run wt:create` clones MCP from your current checkout when `platform/mcp` is a git repo there. Set `WT_SKIP_MCP=1` to skip.

## Local Data API

With `npm run db:up`, PostgREST serves the curated `api` schema on port 3010. Mint dev JWTs from the monorepo root:

```bash
node scripts/mint-dev-jwt.mjs
```

See the MCP repo for client setup (Claude Desktop, Claude Code, HTTP transport, etc.).
