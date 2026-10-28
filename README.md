# EA Rooom

EA Rooom is a community-first platform for building, testing, sharing, copying, and running trading strategies without requiring users to write code.

## Product direction

The MVP focuses on a friendly social experience around strategies rather than presenting itself as a technical EA development tool.

Core MVP flow:

1. Sign up and create a profile.
2. Build a strategy with a simple 4-step wizard.
3. Save the strategy as Public or Private.
4. Explore, copy, or fork strategies from the community.
5. Backtest through the EA Engine on the user's MT5.
6. Send test/run results back to the web dashboard.

## Repository structure

- `web/` — Next.js web app for Vercel.
- `supabase/` — database schema, migrations, RLS policies, and backend notes.
- `ea-engine/` — shared MQL5 EA Engine and integration notes.
- `docs/` — architecture, API contracts, roadmap, and product specifications.

## Planned stack

- Frontend: Next.js + TypeScript
- Hosting: Vercel
- Auth / Database: Supabase
- Trading runtime: MetaTrader 5 / MQL5
- Source control: GitHub

## Development approach

`main` should stay deployable. Feature work can be developed in branches and merged through pull requests as the project grows.

## Status

Initial project scaffold.
