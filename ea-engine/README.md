# EA Engine

Shared MetaTrader 5 / MQL5 runtime for EA Rooom strategies.

The long-term goal is one reusable EA Engine that loads strategy configuration instead of generating a separate EA for every strategy.

Initial responsibilities:

- Authenticate / identify the EA Rooom user or installation
- Load a selected strategy configuration
- Execute entry, management, exit, and risk rules
- Support MT5 Strategy Tester
- Report backtest and runtime results to the platform
- Keep strategy logic versioned and reproducible

MQL5 source and integration documentation will live here.
