# Supabase

Supabase will provide authentication, PostgreSQL storage, row-level security, and backend data services for EA Rooom.

Initial data domains:

- profiles
- strategies
- strategy_versions
- strategy_forks
- backtest_runs
- live_or_demo_runs
- follows / community relationships

Database migrations and RLS policies will live in this directory.

## Applying migrations

For a hosted Supabase project, open **SQL Editor** and run migrations in filename order. The initial `strategies` migration creates private owner-only strategies. The `public_strategies` migration adds opt-in sharing and lets visitors read only strategies marked public. Never put a service-role key in the web app.
