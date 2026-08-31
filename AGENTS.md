# Curvenote

This is the Curvenote monorepo (SCMS, packages, CLI, and platform apps). The integration branch is `dev`.

## Skills

First-party and vendored skills live in `.agents/skills/<name>/SKILL.md`. Third-party skills are installed with `npx skills` and locked in `skills-lock.json`. `bun run agents:setup` does not install them.

Cursor and Codex read `.agents/skills/` without extra setup. Claude Code does not.

## Agent setup

If you use Claude Code, Cursor, or Codex:

```bash
bun run agents:setup <claude|cursor|codex|all>
```

- `claude` — `.claude/skills` → `.agents/skills` and `CLAUDE.md` → `AGENTS.md` (local, not committed)
- `cursor` — `.cursor/skills` → `.agents/skills`
- `codex` — `.codex/skills` → `.agents/skills`
- `all` — cursor, then codex, then claude

A Cursor-only user can skip setup and still get skills plus the norms below.

## Lint And Format Checks

- After edits, run the narrowest relevant package/workspace checks first, including lint, format fix/check, compile, and focused tests where available.
- For package-only edits, prefer scoped workspace commands such as `bun run --filter <package> lint`, `bun run --filter <package> lint:format:fix`, and `bun run --filter <package> lint:format`.
- Do not use `bun run lint --filter <package>` (or the same pattern for format scripts) — that runs the root Turbo lint/format scripts with their broad `@curvenote/*` filters and only appends `--filter` to Turbo.
- Run top-level `bun run lint`, `bun run lint:format:fix`, and `bun run lint:format` when changes touch root/shared files, generated workspace metadata, multiple packages, or before final handoff for broad repo work.
- Fix issues introduced by the current changes. If broad top-level checks report unrelated pre-existing warnings or dirty files, report them separately instead of folding them into the current work.

## Worktrees

To create a new worktree with a working environment use the script `bun run wt:create <branch-name>`

Extension repos under `extensions/` and `extensions/plugins/` are cloned automatically from your current checkout (no repo list in git). Use `WT_SKIP_EXTENSIONS=1` to skip.

Always create worktrees from the `dev` branch, if the working folder is not on `dev` use `bun run wt:create <branch-name> dev`

If you need to create a workspace on an existing branch use `bun run wt:create <branch-name> --existing`
