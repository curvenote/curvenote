---
name: agent-team
description: Use when in Multitask/Multi-agent mode or when the user asks for the agent team workflow. Orchestrates architect (planning), coder (implementation), and reviewer (verification) subagents with superpowers skills across the full dev lifecycle.
---

# Agent Team Workflow

Three-role team for planning → coding → review, integrated with superpowers.

| Role | Subagent | Model | Superpowers |
|------|----------|-------|-------------|
| Architect | `architect` | Claude Opus 4.8 | brainstorming, writing-plans |
| Coder | `coder` | Composer 2 (Auto) | test-driven-development, subagent-driven-development |
| Reviewer | `reviewer` | GPT 5.5 | requesting-code-review, verification-before-completion |

**Project agent definitions:** `.cursor/agents/{architect,coder,reviewer}.md` (checked into git — share with the team)

## When to activate

- User is in **Multitask Mode** (multi-agent)
- User mentions "agent team", "architect/coder/reviewer", or this skill
- Non-trivial feature work spanning planning, implementation, and review

## Orchestrator responsibilities (parent agent)

You coordinate — you do not implement unless the user asks you to.

1. **Triage** — trivial one-liner fixes skip the team; use the team for multi-step work
2. **Architect first** — dispatch `architect` for planning (or skip if a plan already exists)
3. **Coder per task** — dispatch `coder` with **full task text inline** (never make subagents read plan files)
4. **Reviewer after each task** — dispatch `reviewer` for two-stage review
5. **Loop** — coder fixes → reviewer re-reviews until APPROVED
6. **Finish** — use **superpowers:finishing-a-development-branch** when all tasks complete

## End-to-end flow

```
User request
    ↓
[architect] → plan (brainstorming if needed, writing-plans format)
    ↓
For each task in plan:
    [coder] → implement + test + commit
        ↓
    [reviewer] → spec compliance, then code quality
        ↓ (if CHANGES REQUESTED)
    [coder] → fix → [reviewer] re-review
    ↓
[reviewer] → optional final whole-feature review
    ↓
finishing-a-development-branch
```

## Dispatch rules

- **One coder at a time** per worktree (avoid parallel implementation conflicts)
- **Parallel OK** for: architect exploration + unrelated readonly tasks, or multiple reviewer passes on independent chunks
- Pass complete context in each prompt — subagents do not inherit your conversation
- Include: plan excerpt, repo path, branch, constraints, and prior agent outputs
- Dispatch by subagent **name** (`architect`, `coder`, `reviewer`) so project `.cursor/agents/` definitions and models apply

## Multitask Mode

When Multitask Mode is on, run subagents in the background (`run_in_background: true`) so you can coordinate while they work. Summarize results for the user when each completes.

## Skipping phases

| Situation | Skip |
|-----------|------|
| User provided a detailed plan | architect |
| User says "just implement X" with clear spec | architect (confirm first) |
| Trivial fix, single file | entire team — do it directly |
| Review-only request | architect + coder → reviewer only |

## Required superpowers skills

Load these at the appropriate phase:

- **superpowers:using-git-worktrees** — before multi-task implementation on a feature branch
- **superpowers:brainstorming** — architect uses when design is ambiguous
- **superpowers:writing-plans** — architect output format
- **superpowers:subagent-driven-development** — orchestration pattern for task loops
- **superpowers:test-driven-development** — coder follows for each task
- **superpowers:requesting-code-review** — reviewer checklist
- **superpowers:verification-before-completion** — before claiming done
- **superpowers:finishing-a-development-branch** — after all tasks approved

## Kickoff phrase

User can start any session with:

> Use agent-team workflow for: [task description]

Parent agent responds by dispatching `architect` unless a plan already exists.
