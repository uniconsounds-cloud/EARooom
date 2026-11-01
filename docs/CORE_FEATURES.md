# EARooom Core Features

This document records two confirmed core product requirements for the current development branch.

## 1. AI Strategy Interpreter

Users must be able to create a strategy in either of two equal ways:

### A. Manual Builder
- Users configure conditions directly in the existing Builder UI.
- Examples: EMA period/value relationships, Stochastic conditions, candle conditions, Signal Setup, Trigger, Exit and Risk rules.
- Manual configuration must remain fully available and must not require AI.

### B. Describe to AI
- Users may type or later speak their trading method in natural language.
- The AI interprets the description and maps it into the same structured strategy model used by Manual Builder.
- The AI should not invent missing rules silently. Ambiguous or missing details should be surfaced for confirmation.
- The user must be able to review and edit the interpreted result in Manual Builder before continuing.
- Text/transcript input is the MVP. Voice-to-text can be added next. Full video understanding is a later phase.

### Shared output
Both paths must converge on one canonical Strategy JSON / strategy schema.

Manual Builder -> Strategy JSON
AI Describe -> Strategy JSON

The same strategy definition must then be reusable by visualization, validation, backtesting and the EA engine.

## 2. Strategy Visualizer / Simulated Strategy Chart

The Builder must include an illustrative chart that updates in real time as strategy settings change.

### Purpose
- Help users understand visually what their configured rules mean.
- Show where Signal conditions become true.
- Show when Trigger conditions fire.
- Show illustrative Entry and Exit locations.
- This is not real market data and is not a backtest.

### Required behavior
- The chart uses simulated/generated price data only.
- It must be clearly labeled as an illustrative/simulated preview.
- Changing strategy parameters should immediately update the relevant visual elements.
- Examples: EMA lines, Stochastic/indicator states, signal highlights, condition matching, trigger markers, entry arrows and exit markers.
- Multiple conditions should be visualized together so users can see when all required conditions match.
- Signal Setup and Trigger remain distinct concepts:
  - Signal Setup = whether the market state satisfies the configured conditions.
  - Trigger = the exact event/time/price rule that causes an order to open after the signal is valid.
- Where useful, the UI should show partial matching such as 3/4 conditions matched.

### Scenario Generator
The visualizer should be able to generate an illustrative price scenario that intentionally demonstrates the configured strategy, rather than relying on arbitrary candles.

Example flow:
Strategy JSON -> Scenario Generator -> Rule Evaluator -> Visual Strategy Simulator

### Single logic source
The visualizer must not implement independent trading logic that can drift from the future backtest/EA logic.

Target architecture:
Text/Voice -> AI Interpreter -> Strategy JSON
Manual Builder -> Strategy JSON
Strategy JSON -> Rule Evaluator -> Visual Strategy Simulator
Strategy JSON -> Backtest / EA Engine

The Strategy JSON / rule definitions should be the single source of truth so the visual preview, backtest and EA behavior stay aligned.

## Product principle
EARooom should let a user either "set it themselves" or "describe it to AI" without forcing one workflow. Both approaches must produce the same editable strategy and the same visual explanation.
