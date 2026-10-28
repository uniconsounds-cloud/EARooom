# EA Rooom Architecture

## Principle

EA Rooom uses a configuration-driven architecture: strategies are data, while the web platform and EA Engine are reusable software.

## High-level flow

1. User builds or copies a strategy on the web app.
2. Strategy definition is stored and versioned in Supabase.
3. The EA Engine receives or loads the selected strategy configuration.
4. MT5 executes the strategy for backtest, demo, or live use.
5. Results are sent back to the platform.
6. The website shows community and verified performance views from the same data model.

## Main components

### Web
Next.js application deployed on Vercel.

### Supabase
Authentication, PostgreSQL database, row-level security, and platform data.

### EA Engine
Reusable MQL5 execution engine for MT5.

### API contract
The web/backend and EA Engine should communicate through explicit versioned payloads so old strategy versions remain reproducible.

## MVP boundaries

Included:
- Accounts and profiles
- 4-step strategy builder
- Public/private strategies
- Explore strategy listings
- Copy/fork
- Local MT5 backtest flow
- Result reporting/dashboard

Deferred:
- Cloud backtesting
- Managed VPS runtime
- Creator payouts / marketplace
- Full social feed
- AI strategy generation
- 3D virtual world / community rooms
