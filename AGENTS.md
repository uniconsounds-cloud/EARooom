# EARooom — AI / Developer Collaboration Protocol

This repository is designed to be developed by multiple AI agents and human developers over time.

The goal of this file is to prevent context loss, conflicting implementations, silent product changes, and duplicated work.

## Mandatory reading order before work

Before making meaningful changes, every AI agent or developer must read:

1. `docs/MASTER_SPEC.md` — canonical product and architecture specification
2. `docs/PROJECT_STATE.md` — current status, active decisions, scope, and change history
3. Relevant implementation files for the feature being changed
4. Any specialized docs referenced by the two files above

Do not assume documentation means the feature is implemented. Inspect the code.

## Single source of truth hierarchy

Use this priority order when documents disagree:

1. Newer explicit decision recorded in `docs/PROJECT_STATE.md`
2. `docs/MASTER_SPEC.md`
3. Specialized docs such as `docs/CORE_FEATURES.md` and `docs/ARCHITECTURE.md`
4. Older planning notes

If a conflict is discovered, resolve it explicitly and update the docs instead of guessing.

## Required workflow

### Before coding

- Inspect the current branch.
- Understand what is already implemented.
- Check whether the requested change modifies product scope, architecture, schema, or an accepted decision.
- Reuse existing architecture where practical.

### During coding

- Keep Strategy JSON / rule definitions as the intended single source of trading logic.
- Avoid duplicate implementations of the same trading rule across visualizer, backtest, and EA layers.
- Preserve compatibility unless a breaking change is intentional and documented.
- Do not silently remove existing functionality.

### Before finishing

For any meaningful change, update `docs/PROJECT_STATE.md` with:

- What was added
- What was changed
- What was fixed
- What was removed
- What was deferred
- What was rejected
- Important decisions
- Known issues
- Migration or compatibility notes when relevant

If the product definition or architecture itself changes, update `docs/MASTER_SPEC.md` as well.

Then commit documentation together with, or immediately after, the implementation change.

## What counts as a meaningful change

Update the project state for changes such as:

- New feature
- Major UI workflow change
- Strategy schema change
- Rule semantics change
- Database/schema migration
- New API contract
- New infrastructure dependency
- Vercel/Supabase/runtime architecture change
- New AI behavior
- New trading module
- Removal or deprecation of a feature
- Major bug fix affecting expected behavior
- Scope change
- Product decision
- Security-related implementation change

Tiny formatting-only or typo-only edits do not require a state entry unless they change meaning.

## Never erase project history silently

If a previous idea is no longer wanted, record it as one of:

- Removed
- Rejected
- Deferred
- Superseded

Include the reason when useful.

Do not delete the historical decision from `docs/PROJECT_STATE.md` simply because the direction changed.

## Branch and deployment policy

- `main` should remain stable and production-ready.
- Development should normally happen on feature branches.
- Use Vercel Preview deployments to validate feature branches.
- Merge to `main` only after the feature is considered ready.

## Product principles that require explicit approval before changing

Do not change these implicitly:

- EARooom is community-first, not only an EA Builder.
- Users can create strategies manually or through AI description.
- Both creation paths converge on one canonical Strategy JSON.
- Entry distinguishes Signal Setup from Trigger.
- Strategy Visualizer uses illustrative/simulated data and is not a backtest.
- Visualizer, Backtest, and future EA Engine should share rule definitions to avoid logic drift.
- GitHub is the collaboration source of truth.

If a task genuinely requires changing one of these principles, document the new decision first.

## Handoff format for the next agent

At the end of substantial work, leave the repository in a state where the next agent can determine:

- Current branch
- What was just implemented
- Files changed
- What works
- What remains incomplete
- Known issues
- Next recommended step

Use `docs/PROJECT_STATE.md` for durable continuity rather than relying only on chat history.

## Recommended first instruction to any new AI agent

> Read `AGENTS.md`, `docs/MASTER_SPEC.md`, and `docs/PROJECT_STATE.md` first. Then inspect the current branch and relevant implementation. Do not start implementation until you understand the current state and accepted product decisions. After meaningful work, update `docs/PROJECT_STATE.md` before finishing.
