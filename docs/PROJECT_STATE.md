# EARooom — Project State, Decision Log, and Change History

> **Purpose:** This is the shared continuity file for all AI agents and developers working on EARooom.
>
> **Required workflow:** Read this file before starting work. Update it whenever meaningful product, architecture, schema, scope, implementation status, or design decisions change.
>
> The canonical product specification is `docs/MASTER_SPEC.md`.

---

## 1. Current Project Status

### Active repository

`uniconsounds-cloud/EARooom`

### Current active development branch

`feat/landing-page`

### Stable branch

`main`

### Deployment workflow

- Feature branches are used for development.
- Vercel Preview deployments are used for testing before merge.
- `main` should remain stable and represent production-ready work.

### Current stack

- Next.js
- TypeScript
- Vercel
- Supabase / PostgreSQL / Auth / RLS
- GitHub
- Future trading runtime: MetaTrader 5 / MQL5

---

## 2. Confirmed Product Direction

EARooom is a **community-first automated trading strategy platform for non-programmers**.

The product is not intended to be only an EA Builder.

The confirmed core loop is:

```text
Think -> Build -> Visualize -> Test -> Run -> Share -> Copy/Fork -> Improve
```

The platform must remain friendly, visual, and accessible to ordinary traders.

---

## 3. Confirmed Core Features

### A. Manual Strategy Builder

Users can configure strategy logic directly without AI.

High-level structure:

1. Entry
2. Position Management
3. Exit
4. Protection / Risk

Entry is split into:

- Signal Setup
- Trigger

### B. AI Strategy Interpreter

Users can alternatively type or paste a transcript describing their trading idea.

AI converts the description into structured rules, but the user must review and edit the result before accepting it.

AI must not silently invent important missing strategy rules.

Initial scope:

- Text input
- Pasted transcript

Later:

- Voice-to-text

Deferred:

- Image-to-strategy
- Full video understanding

### C. Canonical Strategy JSON

Manual Builder and AI Interpreter must both output the same versioned strategy schema.

This schema is intended to become the single source of truth for:

- Builder
- Validation
- Visualizer
- Backtest
- EA Engine

### D. Real-Time Strategy Visualizer

The Builder includes a simulated chart that visually explains the configured strategy.

It is not live market data and not a backtest.

The chart should eventually show:

- Indicator lines
- Signal condition matching
- Partial matching such as `3 / 4`
- Signal readiness
- Trigger points
- Entry arrows
- Exit markers

The current branch already contains an animated Entry preview implementation and is moving in this direction.

### E. Scenario Generator

The visualizer should eventually generate illustrative market scenarios designed to demonstrate the current strategy instead of relying only on arbitrary simulated candles.

### F. Community Layer

Confirmed long-term community concepts:

- Profiles
- Public / Private strategies
- Explore
- Follow
- Like
- Comment
- Save
- Copy
- Fork
- Version history
- Creator pages
- Verified performance

---

## 4. Current Implementation Notes

The active development branch has already introduced an animated Strategy Builder preview for Entry configuration.

Known direction:

- Builder contains Signal Setup and Trigger concepts.
- Visual chart preview reacts to strategy configuration.
- Preview chart is simulated/illustrative.
- Vercel Preview is used as the development/test environment.
- Vercel and Supabase have been connected for the project.

Do not assume features are complete solely because they are documented. Inspect the current code before implementation.

---

## 5. MVP Priority

Current recommended implementation order:

1. Authentication and profiles
2. Versioned strategy schema and rule definitions
3. Manual Strategy Builder
4. Signal Setup + Trigger model
5. Real-time Strategy Visualizer
6. Strategy save/edit/duplicate/public/private/versioning
7. Explore / Strategy Detail / Creator Profile / Copy/Fork
8. AI text/transcript Strategy Interpreter
9. Rule validation and human confirmation
10. Local MT5 backtest integration
11. Verified performance reporting

---

## 6. Deferred / Not Current Priority

Do not prioritize unless a new explicit decision changes scope:

- Full marketplace payments
- Creator payouts
- Full video understanding
- Image-to-strategy import
- Managed VPS / Cloud Runner implementation
- Large cloud optimization infrastructure
- Cloud backtesting infrastructure
- 3D virtual world
- Complex full social feed
- Native mobile app

These remain valid future ideas, not rejected ideas.

---

## 7. Important Architecture Decisions

### Decision: Strategies are data, not separate EA programs

Status: **Accepted**

Reason: One reusable EA Engine should eventually execute many versioned strategies.

### Decision: Manual and AI creation are equal workflows

Status: **Accepted**

Reason: Some users prefer direct configuration; others prefer describing the idea in natural language.

### Decision: Signal Setup and Trigger are separate

Status: **Accepted**

Reason: Market readiness and the exact entry event are different concepts and should remain separate in UI and schema.

### Decision: Visualizer uses simulated data

Status: **Accepted**

Reason: Its job is to explain strategy behavior visually, not to represent actual market history or backtest results.

### Decision: Shared rule definitions must prevent logic drift

Status: **Accepted**

Reason: Visualizer, Backtest, and EA Engine must not interpret the same rule differently.

### Decision: GitHub is the collaboration source of truth

Status: **Accepted**

Reason: Multiple AI agents and developers must be able to continue work using the same repository history and documentation.

### Decision: Feature branch + Vercel Preview workflow

Status: **Accepted**

Reason: Development can proceed without destabilizing production `main`.

---

## 8. Change Log

### 2026-11-01 — Documentation continuity system added

**Added**

- `docs/MASTER_SPEC.md` as the canonical product and architecture specification.
- `docs/PROJECT_STATE.md` as the shared project status, decision log, and change history.
- Root collaboration instructions are being added so future AI agents must read and update these files.

**Purpose**

Ensure multiple AI agents and developers can work on the same repository without losing product context, implementation status, accepted decisions, rejected directions, or scope changes.

### 2026-10-31 — AI Interpreter + Visualizer direction confirmed

**Confirmed**

- Manual Builder remains fully available.
- Natural-language strategy creation is an optional parallel workflow.
- Both produce the same Strategy JSON.
- Text/transcript is the initial AI input scope.
- Voice can follow later.
- Image and video interpretation are deferred.
- Strategy Visualizer is a core feature.
- Visualizer must update in response to strategy changes.
- Signal Setup and Trigger remain distinct.
- Scenario Generator is part of the intended visualizer architecture.

### 2026-10-31 — Entry preview implementation advanced

**Observed in active branch**

- Animated simulated chart preview added to Entry Builder work.
- Indicator/price scene updates are animated rather than fully remounted.
- Timeframe interaction and chart-depth presentation were introduced.

### 2026-10-28 — Initial repository architecture established

**Added**

- Initial repository scaffold
- `web/`
- `supabase/`
- `ea-engine/`
- `docs/`
- Initial architecture documentation

---

## 9. How to Record Future Changes

Every meaningful change should append a new entry at the top of the Change Log section with the date and one or more of these labels:

- `Added`
- `Changed`
- `Fixed`
- `Removed`
- `Deferred`
- `Rejected`
- `Decision`
- `Known issue`

Example:

```markdown
### YYYY-MM-DD — Strategy schema v0.2

**Changed**
- Replaced `entry.conditions` with nested condition groups.

**Decision**
- Strategy schema v0.2 becomes the active schema for new strategies.

**Migration**
- Existing v0.1 strategies remain readable.
```

When a feature or direction is deliberately abandoned, record it explicitly under `Removed` or `Rejected`. Do not silently delete history.

---

## 10. Mandatory Handoff Checklist

Before completing meaningful work, an AI agent or developer should verify:

- [ ] I read `docs/MASTER_SPEC.md`.
- [ ] I read this `docs/PROJECT_STATE.md`.
- [ ] I inspected the current implementation instead of assuming docs equal code.
- [ ] I preserved or explicitly documented architecture changes.
- [ ] I updated this file for meaningful changes.
- [ ] I recorded anything removed, rejected, or deferred.
- [ ] I left enough context for the next agent to continue without the original conversation.

