# EARooom — Master Project Specification

> **Purpose:** This file is the canonical product and architecture specification for EARooom. Any AI agent, developer, or automation working on this repository should read this file before making product or implementation decisions.
>
> **Source of truth:** When this document conflicts with older planning notes, this document takes precedence unless `docs/PROJECT_STATE.md` records a newer explicit decision.

---

## 1. Product Vision

EARooom is a community-first platform that allows ordinary traders to create, understand, test, run, share, copy, fork, and improve automated trading strategies without writing code.

The platform should feel like a friendly social product, not like a programming IDE, quant terminal, or node-based engineering tool.

Core user journey:

```text
Think -> Build -> Visualize -> Test -> Run -> Share -> Copy/Fork -> Improve
```

A useful shorthand is:

> Facebook + GitHub + TradingView + a no-code EA strategy platform

The product should help users feel that they are **designing a trading idea**, not programming an EA.

---

## 2. Foundational Architecture Principle

A trading strategy is **configuration/data**, not a separately compiled EA.

EARooom should eventually support many strategies through one reusable execution engine.

```text
Strategy Definition
      ↓
Canonical Strategy JSON
      ↓
Shared Rule Definitions / Rule Evaluator
      ↓
Visualizer / Validator / Backtest / EA Engine
```

This avoids creating one EA file per strategy.

A single reusable MT5/MQL5 EA Engine should be able to consume compatible strategy definitions.

---

## 3. Two Equal Strategy Creation Paths

Users must be able to create the same strategy through either workflow.

### 3.1 Manual Builder

The user configures strategy rules directly using a friendly UI.

Examples:

- Price > EMA 200
- Stochastic < 20
- RSI < 30
- Bullish reversal candle
- Break previous candle high

Manual configuration must remain fully usable without AI.

### 3.2 Describe to AI

The user may type or paste a transcript describing the trading method in natural language.

Example:

> Buy only when price is above EMA 200, Stochastic is oversold, and a bullish reversal candle appears. Enter when the next candle breaks the reversal candle high.

The AI should convert the description into structured strategy rules.

The AI must **not silently invent important missing logic**. Ambiguous or incomplete rules should be surfaced for confirmation.

The interpreted result must be editable in the same Manual Builder before it is accepted.

### 3.3 Shared Output

Both workflows must converge on the same canonical strategy schema.

```text
Manual Builder ────────┐
                       ├─> Strategy JSON
AI Description ────────┘
```

That same strategy definition is used by visualization, validation, backtesting, and later EA execution.

---

## 4. Strategy Builder Mental Model

The primary Builder is intentionally simple and is organized into four high-level stages.

### Step 1 — Entry

Question: **When should a trade begin?**

Entry is itself divided into two concepts:

#### Signal Setup

Signal Setup determines whether the market state satisfies the configured conditions.

Examples:

- Price > EMA 200
- EMA 50 > EMA 200
- RSI < 30
- Stochastic < 20
- Bollinger lower band touched
- Support or resistance condition
- Liquidity sweep
- Candle pattern
- Pullback
- Breakout context

Multiple conditions may use:

- AND
- OR
- Condition groups

Example:

```text
Price > EMA 200
AND
(
  RSI < 30
  OR
  Stochastic < 20
)
AND
Bullish reversal candle
```

#### Trigger

Signal Setup means: **the environment is ready**.

Trigger means: **open now when this specific event happens**.

Examples:

- Enter immediately
- Next candle open
- Candle close
- Break previous high
- Break previous low
- Retest price
- Return to EMA
- Price crosses a defined level
- Confirmation candle
- Wait X points
- Wait X seconds

Signal Setup and Trigger must remain conceptually separate in both UI and strategy schema.

---

## 5. Step 2 — Position Management

Question: **What should happen after the first trade opens?**

Possible modules include:

- Single Entry
- Fixed Grid
- ATR Grid
- Signal Re-entry
- Average Down
- Average Up
- Follow Price
- Fixed Lot
- Ladder Lot
- Lot Multiplier
- Progressive Lot
- Reduced Lot
- Maximum Orders
- Maximum Total Lot
- Minimum Distance
- Minimum Time Between Entries
- One Order Per Bar

This area should be modular so additional management logic can be added without redesigning the platform.

---

## 6. Step 3 — Exit / Profit Management

Question: **When and how should the strategy finish?**

Possible modules:

- Take Profit per trade
- Stop Loss per trade
- Basket Profit in money
- Basket Profit in percent
- Average Price + Buffer
- Break Even + Buffer
- Trailing Stop
- Basket Trailing
- Opposite Signal Exit
- Close Profitable Orders
- Close Oldest Order
- Partial Close
- Time-based Exit
- Close BUY basket separately
- Close SELL basket separately
- Close All

---

## 7. Step 4 — Protection / Risk

Question: **What should happen when conditions become dangerous?**

Possible modules:

- Maximum Drawdown %
- Maximum Loss $
- Maximum Orders
- Maximum Total Lots
- Stop Adding
- Emergency Close
- Spread Protection
- Trading Hours
- Daily Profit Target
- Daily Loss Limit
- Cooldown
- Pause After Loss
- Friday Protection
- Volatility Protection
- ATR Protection
- Abnormal Movement Detection
- Hibernation Mode
- Survival Mode

Risk should be a dedicated layer instead of being hidden inside entry or exit logic.

---

## 8. Strategy Dictionary

EARooom should maintain a controlled Strategy Dictionary that maps human trading language into measurable definitions.

Examples:

### Human phrase: Strong Move

Possible technical mapping:

```text
movement_distance >= 1.5 × ATR
```

### Human phrase: Small Consolidation

Possible technical mapping:

```text
1–5 candles
average candle body < 0.5 × ATR
range compression detected
```

### Human phrase: Strong Breakout

Possible technical mapping:

```text
candle body >= 1.0 × ATR
AND
close > consolidation high
```

Potential dictionary concepts:

- Strong Move
- Weak Move
- Trend
- Sideway
- Pullback
- Breakout
- Retest
- Rejection
- Support
- Resistance
- Supply Zone
- Demand Zone
- Liquidity Sweep
- Order Block
- Fair Value Gap
- BOS
- CHOCH
- Momentum
- Compression
- Expansion
- Wick Rejection

Key principle:

> AI interprets language, while the Strategy Dictionary defines the trading meaning.

AI should not redefine core trading concepts differently on every request.

---

## 9. AI Strategy Interpreter

Recommended pipeline:

```text
User Text / Transcript
      ↓
AI Interpreter
      ↓
Strategy Dictionary Mapping
      ↓
Rule Validator
      ↓
Clarification / Confirmation
      ↓
Canonical Strategy JSON
```

MVP priority:

1. Typed text
2. Pasted transcript
3. Voice-to-text later
4. Full image/video interpretation later

The AI layer should be a replaceable service, not tightly coupled to one model provider.

---

## 10. AI API Architecture

AI API keys must never be exposed directly in the browser.

Recommended flow:

```text
Browser
  ↓
Server-side API on Vercel
  ↓
AI Provider API
  ↓
Structured Response
  ↓
Rule Validator
  ↓
Supabase / Builder
```

The AI provider should sit behind an abstraction such as `AIInterpreter` so future models can be substituted without changing the strategy schema or EA Engine.

---

## 11. Strategy Visualizer — Core Feature

The Builder must include a simulated real-time strategy chart.

This is one of EARooom's most important differentiators.

The chart is:

- Not live market data
- Not a backtest
- An illustrative strategy explanation

Its purpose is to let users immediately see what their selected rules mean.

---

## 12. Visualizer Behavior

If a user configures:

```text
EMA = 200
Stochastic < 20
Bullish reversal candle
Break previous candle high
```

The chart should be able to show:

- EMA 200 line
- Relevant indicator state
- Candles satisfying conditions
- Signal Setup readiness
- Trigger location
- Entry arrow
- Entry price
- Eventually Exit location

If the user changes EMA 200 to EMA 400, the visual representation should immediately update.

If another rule is added, the visualizer should reflect the combined rules.

---

## 13. Multi-Condition Visualization

The UI should be able to explain partial rule matching.

Example:

```text
✓ Price > EMA 200
✓ RSI < 30
✓ Stochastic < 20
✗ Bullish reversal candle

Signal readiness: 3 / 4
```

When all conditions become true:

```text
4 / 4
SIGNAL READY
```

The Trigger then becomes active and the preview can show the eventual order event.

---

## 14. Scenario Generator

The preview should not depend on arbitrary random candles.

A Scenario Generator should intentionally create illustrative market situations that demonstrate the currently configured strategy.

```text
Strategy JSON
      ↓
Scenario Generator
      ↓
Simulated Market Scenario
      ↓
Rule Evaluator
      ↓
Visual Strategy Simulator
```

Example: if a strategy requires price above EMA, Stochastic oversold, and a bullish reversal, the scenario generator should create a clear illustrative sequence in which those conditions occur.

---

## 15. Single Source of Trading Logic

Do not create independent condition logic in the Visualizer, Backtest, and EA Engine.

Bad outcome to avoid:

```text
Visualizer: BUY here
Backtest: BUY somewhere else
EA Engine: enters at a third location
```

Target architecture:

```text
                 Strategy JSON
                       |
              Shared Rule Definitions
                       |
                Rule Evaluator
              /        |        \
             /         |         \
      Visualizer    Backtest    EA Engine
```

The canonical schema and rule definitions must be the single source of truth.

---

## 16. Community Concept

EARooom must not become only an EA Builder.

Community is a core product layer.

Each user should eventually have:

- Profile
- Avatar
- Bio
- Strategies
- Followers
- Following
- Performance summary
- Reviews
- Activity

Each Strategy should eventually have its own page with features such as:

- Like
- Comment
- Follow creator
- Save
- Copy
- Fork
- Share
- Review
- Version History

---

## 17. Copy / Fork Model

A user can copy or fork a public strategy and customize it without affecting the original.

Example:

```text
Original Strategy
   ↓
Fork A
   ↓
Fork B
```

Possible ancestry should be preserved so the community can see how ideas evolve.

This is conceptually similar to GitHub forks, but for trading strategies.

---

## 18. Strategy Verification

Strategies should eventually distinguish between:

- Unverified
- Backtested
- Demo Verified
- Live Verified

Avoid relying on screenshots where possible.

Future runtime integrations should send performance data directly to the platform.

Potential metrics:

- Return
- Drawdown
- Trading days
- Number of trades
- Win rate
- Profit factor
- Average trade
- Largest loss
- Lots
- Account type
- Demo / Live
- Verified period

---

## 19. Explore / Discovery

Potential strategy discovery categories:

- Trending Strategies
- Most Copied
- Most Forked
- Best Verified
- Low Drawdown
- New Strategies
- Gold
- Forex
- Crypto
- Scalping
- Swing
- Grid
- Trend Following
- Mean Reversion

Creator discovery can later include:

- Top Creators
- Rising Creators
- Most Followed
- Most Copied
- Best Verified

---

## 20. Homepage Concept

The homepage should communicate the product immediately.

Possible message:

> Build your own automated trading strategy. No coding required.

Primary actions:

- Create Strategy Free
- Explore Strategies

Suggested homepage flow:

```text
Hero
↓
4-Step Builder explanation
↓
Trending Strategies
↓
Build → Test → Run → Share
↓
Verified Performance
↓
Top Creators
↓
Community
```

Potential navigation:

- Explore
- Build
- My Strategies
- Backtest
- Community
- Pricing

---

## 21. Technical Stack

### Frontend

- Next.js
- TypeScript
- Vercel deployment

### Backend / Data

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security

### Trading Runtime

- MetaTrader 5
- MQL5 reusable EA Engine

### Source Control

- GitHub

GitHub is the single source of truth for code and project documentation.

---

## 22. High-Level Platform Flow

```text
User
 ↓
EARooom Web
 ↓
Manual Builder / AI Interpreter
 ↓
Strategy JSON
 ↓
Supabase
 ↓
Versioned Strategy
 ↓
EA Engine
 ↓
MT5
 ↓
Broker
```

Results return:

```text
MT5
 ↓
EARooom API
 ↓
Supabase
 ↓
Dashboard
 ↓
Verified Performance
 ↓
Community
```

---

## 23. Suggested Data Domains

Initial domains may include:

- profiles
- strategies
- strategy_versions
- strategy_forks
- strategy_modules
- backtest_runs
- runtime_sessions
- trading_accounts
- performance_snapshots
- follows
- comments
- likes
- saved_strategies

Strategy versioning is especially important.

Do not overwrite the exact strategy definition associated with a historical backtest or live result.

---

## 24. Canonical Strategy JSON

A simplified conceptual example:

```json
{
  "version": "1.0",
  "market": {
    "symbol": "XAUUSD",
    "timeframe": "M1"
  },
  "entry": {
    "direction": "buy",
    "signal": {
      "logic": "all",
      "conditions": [
        {
          "type": "price_above_ema",
          "period": 200
        },
        {
          "type": "stochastic_below",
          "value": 20
        }
      ]
    },
    "trigger": {
      "type": "break_previous_high"
    }
  },
  "management": {},
  "exit": {},
  "risk": {}
}
```

The exact schema must be versioned.

Do not allow frontend component structure to become the platform schema by accident.

The Strategy JSON is an explicit platform contract.

---

## 25. Future EA Engine

The eventual EA should behave as a reusable execution engine rather than one hardcoded strategy.

Conceptual structure:

```text
EARooom Engine.mq5
 ├── Indicator Engine
 ├── Signal Engine
 ├── Trigger Engine
 ├── Position Manager
 ├── Exit Engine
 ├── Risk Engine
 ├── API Client
 └── Result Reporter
```

EA Engine implementation should happen after the strategy schema and rule model become stable enough.

---

## 26. Backtesting Strategy

Initial MVP approach:

Users may run backtests using their own MT5 installation.

```text
EARooom Strategy
 ↓
EA Engine
 ↓
MT5 Strategy Tester
 ↓
Backtest
 ↓
Results returned to EARooom
```

This avoids large early cloud-compute costs.

Cloud Backtest can later become a premium feature.

---

## 27. VPS / Cloud Runner

EARooom does not need to provide a VPS for every user during MVP.

Initially, users can run MT5 on:

- Their own PC
- Their own VPS

Later, EARooom can offer a managed **Cloud Runner** where users press a button such as `Run 24/7` and EARooom manages the runtime.

This can become a separate revenue source.

---

## 28. Business Model

Preferred model: **Free → Pro**.

### Free

Enough functionality to create adoption and network effects.

Possible Free features:

- Profile
- Manual Builder
- Limited strategy count
- Community browsing
- Copy/Fork
- Basic Visualizer
- Limited testing

### Pro

Possible Pro features:

- More strategies
- Advanced modules
- AI interpretation
- Advanced analytics
- Optimization
- Cloud backtesting
- Enhanced runtime connections

Additional future revenue:

- Cloud Runner
- Cloud Backtest credits
- Creator Marketplace
- Premium Strategy Tools
- Creator subscriptions
- Marketplace commission

Broker IB income may exist separately, but the product should be able to stand as a software/community business rather than depending entirely on IB revenue.

---

## 29. Creator Marketplace — Later Phase

Creators may eventually:

- Publish strategies
- Offer free strategies
- Sell premium strategies
- Offer subscriptions
- Build followers
- Build reputation

Potential platform revenue:

- Marketplace commission
- Creator subscription plans
- Premium creator tools

Do not prioritize creator payments before the core Builder and community loop are validated.

---

## 30. Future 3D / Virtual Community World

A future optional feature is a lightweight 3D community experience such as `Enter EA World`.

Potential spaces:

- Central Lobby
- Creator Rooms
- Strategy Rooms
- Virtual Computers
- Strategy Screens
- Performance Displays
- Personal Rooms
- Community Events

This must not become a separate product backend.

It should be another client/UI using the same EARooom APIs and data.

---

## 31. Image / Video Strategy Import — Research Only

These are future research ideas, not MVP requirements.

### Image

```text
Chart Screenshot
 ↓
AI Vision
 ↓
Draft Strategy
 ↓
Human confirmation
 ↓
Strategy JSON
```

### Video

```text
Video
 ↓
Transcript
 + Key Frames
 ↓
AI Analysis
 ↓
Draft Strategy
 ↓
Human confirmation
```

Current priority remains:

- Manual Builder
- Text / Transcript AI

Voice can follow before full image/video understanding.

---

## 32. Development Workflow

GitHub is the single source of truth.

`main` should represent stable / production-ready work.

Feature work should occur on feature branches and use Vercel Preview deployments.

Recommended flow:

```text
Feature Branch
 ↓
Development
 ↓
Vercel Preview
 ↓
Test
 ↓
Fix
 ↓
Approve
 ↓
Merge into main
 ↓
Production Deployment
```

After merge, create a new feature branch for the next major change.

---

## 33. Current Implementation Direction

Current development has already moved toward:

- A Strategy Builder
- Entry split into Signal Setup and Trigger
- A simulated Entry preview chart
- Animated updates to visual price/indicator data when settings change
- Vercel Preview-based branch development
- Supabase/Vercel integration

The current visualizer is still an early implementation and should continue moving toward the shared-rule architecture defined above.

---

## 34. MVP Scope

The first serious usable version should prioritize:

1. Authentication and profiles
2. Versioned strategy schema and rule definitions
3. Manual 4-step Strategy Builder
4. Entry model with Signal Setup + Trigger
5. Real-time simulated Strategy Visualizer
6. Strategy save/edit/duplicate/public/private/versioning
7. Basic community: Explore, Strategy Detail, Creator Profile, Copy/Fork
8. AI text/transcript → Strategy Interpreter
9. Strategy validation and human confirmation
10. Local MT5 backtest integration
11. Verified performance reporting

---

## 35. Deferred Features

Do not let these distract the initial build:

- Full marketplace payments
- Creator payouts
- Full video interpretation
- Image-to-strategy import
- Managed VPS
- Large optimization cluster
- Cloud backtesting infrastructure
- 3D virtual world
- Complex social feed
- Native mobile app

These remain future expansion opportunities.

---

## 36. Core Product Differentiation

EARooom should not position itself merely as a `no-code EA Builder`.

The stronger positioning is:

> Describe or build your trading idea, immediately see how it works visually, turn it into an automated strategy, and share or improve strategies with a community.

The strongest product differentiators are:

1. Human-friendly strategy creation
2. AI interpretation of trading ideas
3. Real-time visual explanation
4. Community Copy/Fork ecosystem

---

## 37. Product Personality

The interface should be:

- Friendly
- Modern
- Visual
- Simple
- Community-oriented
- Non-intimidating

Avoid making it look primarily like:

- Programming IDE
- MQL editor
- Professional quant terminal
- Complex node editor
- Developer tool

---

## 38. One-Sentence Definition

> **EARooom is a community platform where anyone can create, visualize, test, run, share, copy, and improve automated trading strategies without writing code.**

---

## 39. Guidance for AI Agents

Before implementing any feature:

1. Read this file.
2. Read `docs/PROJECT_STATE.md`.
3. Read root `AGENTS.md`.
4. Inspect the current branch and relevant code before assuming implementation state.
5. Preserve the single-source-of-truth Strategy JSON principle.
6. Do not silently change product direction.
7. Record meaningful product, architecture, schema, feature, scope, or implementation-status changes in `docs/PROJECT_STATE.md` before completing the work.

See `AGENTS.md` for the required collaboration protocol.
