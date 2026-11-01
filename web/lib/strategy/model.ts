// Canonical editable strategy shared by Manual Builder, AI, evaluator and runtime adapter.
export type Entry = "ma_cross" | "price_ma" | "rsi_recovery" | "gold_stoch_pullback";
export type Direction = "both" | "buy" | "sell";
export type LotMode = "fixed" | "multiplier";
export type EntryModuleKind = "ema" | "stochastic" | "rsi" | "ma_cross" | "price_cross";
export type EntryModule = { kind: EntryModuleKind; period?: number; fastPeriod?: number; slowPeriod?: number; signalPeriod?: number; level?: number; upperLevel?: number; averageType?: "SMA" | "EMA"; rule?: string; target?: "moving_average" | "price_level" };
export type EntryConditionGroup = { logic: "all" | "any"; conditions: EntryModule[] };
export type EntryTriggerKind = "immediate" | "next_bar_open" | "delay_seconds" | "price_move" | "break_signal_candle" | "pullback_to_ema" | "candle_reversal" | "manual";
export type EntryTrigger = { kind: EntryTriggerKind; emaPeriod?: number; bufferPoints?: number; maxWaitBars?: number; delaySeconds?: number; priceMovePoints?: number; moveDirection?: "favorable" | "adverse" };
export type RecoveryPreset = "distance" | "candle" | "trend" | "range" | "atr" | "manual" | "custom";
export type RecoveryConditionKind = "candle_reversal" | "trend_filter" | "range_reentry" | "atr_gate" | "rsi_recovery" | "manual_confirm";
export type RecoveryCondition = { kind: RecoveryConditionKind; timeframe?: string; period?: number; level?: number; method?: string };
export type AddOrderRule = { logic: "all" | "any"; conditions: RecoveryCondition[]; trigger?: EntryTrigger };
export type ExitRuleKind = "average_target" | "trailing_average" | "partial_close" | "time_limit" | "signal_exit" | "manual_close";
export type ExitRule = { kind: ExitRuleKind; value?: number; secondaryValue?: number; timeframe?: string };
export type RecoveryConfig = {
  maxAdds: number; spacingPoints: number; lotMode: LotMode; lotMultiplier: number;
  preset?: RecoveryPreset; spacingMode?: "fixed" | "atr"; cooldownBars?: number;
  confirmationTimeframe?: string; trendFilter?: "ema_slope" | "ma_alignment";
  rangeSignal?: "band_reentry" | "boundary_rejection"; atrPeriod?: number;
  atrMultiplier?: number; pauseOnAtrExpansion?: boolean; maxWaitBars?: number;
  orderRules?: AddOrderRule[];
};
export type Strategy = {
  schemaVersion: 1; contractVersion?: "1.0.0"; strategyType?: "gold_scalping_recovery"; name: string; symbol: string; timeframe: string; direction: Direction;
  entry: { type: Entry; fastPeriod: number; slowPeriod: number; maPeriod: number; rsiPeriod: number; rsiLow: number; rsiHigh: number; stochasticKPeriod?: number; stochasticDPeriod?: number; stochasticSlowing?: number; stochasticOversold?: number; stochasticOverbought?: number; emaFilterPeriod?: number; trigger?: EntryTrigger; logic?: "all" | "any"; conditions?: RecoveryCondition[]; signalGroup?: EntryConditionGroup; firstEntryGroup?: EntryConditionGroup };
  manage: { lotSize: number; maxPositions: number; mode?: "single" | "recovery"; recovery?: RecoveryConfig };
  exit: { stopLossPips: number; takeProfitPips: number; stopMode?: "fixed_pips" | "swing"; swingLookbackBars?: number; swingBufferPoints?: number; riskRewardRatio?: number; basketStopLoss?: number; basketTakeProfit?: number; closeRules?: ExitRule[] };
  protection: { maxSpreadPoints: number };
};
export const RULE_VERSION = "1.0.0" as const;
export const ENGINE_VERSION = "0.1.0";
