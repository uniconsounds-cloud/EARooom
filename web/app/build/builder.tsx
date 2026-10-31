"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import EntryPreviewChart from "./entry-preview-chart";

const STEPS = ["Entry", "Manage", "Exit", "Protection"] as const;
type Entry = "ma_cross" | "price_ma" | "rsi_recovery" | "gold_stoch_pullback";
type Direction = "both" | "buy" | "sell";
type LotMode = "fixed" | "multiplier";
type EntryModuleKind = "ema" | "stochastic" | "rsi" | "ma_cross" | "price_cross";
export type EntryModule = { kind: EntryModuleKind; period?: number; fastPeriod?: number; slowPeriod?: number; signalPeriod?: number; level?: number; upperLevel?: number; averageType?: "SMA" | "EMA"; rule?: string; target?: "moving_average" | "price_level" };
export type EntryConditionGroup = { logic: "all" | "any"; conditions: EntryModule[] };
type EntryTriggerKind = "immediate" | "next_bar_open" | "delay_seconds" | "price_move" | "break_signal_candle" | "pullback_to_ema" | "candle_reversal" | "manual";
export type EntryTrigger = { kind: EntryTriggerKind; emaPeriod?: number; bufferPoints?: number; maxWaitBars?: number; delaySeconds?: number; priceMovePoints?: number; moveDirection?: "favorable" | "adverse" };
type RecoveryPreset = "distance" | "candle" | "trend" | "range" | "atr" | "manual" | "custom";
type RecoveryConditionKind = "candle_reversal" | "trend_filter" | "range_reentry" | "atr_gate" | "rsi_recovery" | "manual_confirm";
type RecoveryCondition = { kind: RecoveryConditionKind; timeframe?: string; period?: number; level?: number; method?: string };
type AddOrderRule = { logic: "all" | "any"; conditions: RecoveryCondition[]; trigger?: EntryTrigger };
type ExitRuleKind = "average_target" | "trailing_average" | "partial_close" | "time_limit" | "signal_exit" | "manual_close";
type ExitRule = { kind: ExitRuleKind; value?: number; secondaryValue?: number; timeframe?: string };
type RecoveryConfig = {
  maxAdds: number; spacingPoints: number; lotMode: LotMode; lotMultiplier: number;
  preset?: RecoveryPreset; spacingMode?: "fixed" | "atr"; cooldownBars?: number;
  confirmationTimeframe?: string; trendFilter?: "ema_slope" | "ma_alignment";
  rangeSignal?: "band_reentry" | "boundary_rejection"; atrPeriod?: number;
  atrMultiplier?: number; pauseOnAtrExpansion?: boolean; maxWaitBars?: number;
  orderRules?: AddOrderRule[];
};
export type Strategy = {
  schemaVersion: 1; strategyType?: "gold_scalping_recovery"; name: string; symbol: string; timeframe: string; direction: Direction;
  entry: { type: Entry; fastPeriod: number; slowPeriod: number; maPeriod: number; rsiPeriod: number; rsiLow: number; rsiHigh: number; stochasticKPeriod?: number; stochasticDPeriod?: number; stochasticSlowing?: number; stochasticOversold?: number; stochasticOverbought?: number; emaFilterPeriod?: number; trigger?: EntryTrigger; logic?: "all" | "any"; conditions?: RecoveryCondition[]; signalGroup?: EntryConditionGroup; firstEntryGroup?: EntryConditionGroup };
  manage: { lotSize: number; maxPositions: number; mode?: "single" | "recovery"; recovery?: RecoveryConfig };
  exit: { stopLossPips: number; takeProfitPips: number; stopMode?: "fixed_pips" | "swing"; swingLookbackBars?: number; swingBufferPoints?: number; riskRewardRatio?: number; basketStopLoss?: number; basketTakeProfit?: number; closeRules?: ExitRule[] };
  protection: { maxSpreadPoints: number };
};
const defaultEntryTrigger = (): EntryTrigger => ({ kind: "next_bar_open", maxWaitBars: 3 });
const entryTriggerChoices: { id: EntryTriggerKind; label: string; description: string }[] = [
  { id: "immediate", label: "ทันทีเมื่อพร้อม", description: "ส่ง Market order ที่ tick ถัดไปหลังสัญญาณ Setup ผ่าน" },
  { id: "next_bar_open", label: "เปิดแท่งถัดไป", description: "รอแท่งปัจจุบันปิด แล้วเข้าในช่วงเริ่มแท่งใหม่" },
  { id: "delay_seconds", label: "หน่วงเวลา", description: "รอครบเวลาที่กำหนด แล้วเข้าเมื่อ Setup ยังใช้ได้" },
  { id: "price_move", label: "รอราคาขยับตามระยะ", description: "รอราคาเดินหน้าหรือสวนทางจากราคาตอน Setup พร้อม" },
  { id: "break_signal_candle", label: "รอเบรก High/Low แท่งสัญญาณ", description: "เข้าเมื่อราคาทะลุขอบแท่งที่ทำให้ Setup พร้อม" },
  { id: "pullback_to_ema", label: "รอย่อกลับถึง EMA", description: "รอราคาย่อแตะเส้น EMA ก่อนเข้า" },
  { id: "manual", label: "รอยืนยันด้วยตนเอง", description: "แจ้งว่าพร้อมแล้ว แต่ยังไม่เข้าอัตโนมัติ" },
];
const moduleLabels: Record<EntryModuleKind, string> = { ema: "EMA", stochastic: "Stochastic", rsi: "RSI", ma_cross: "เส้นค่าเฉลี่ยตัดกัน", price_cross: "ราคาตัดเส้นค่าเฉลี่ย" };
function newEntryModule(kind: EntryModuleKind, stage: "signal" | "entry"): EntryModule {
  if (kind === "ema") return { kind, period: 400, rule: "with_direction" };
  if (kind === "stochastic") return { kind, period: 15, signalPeriod: 2, slowPeriod: 9, rule: stage === "signal" ? "extreme_for_direction" : "cross_for_direction", level: 20, upperLevel: 80 };
  if (kind === "rsi") return { kind, period: 14, level: 30, upperLevel: 70, rule: "recover_for_direction" };
  if (kind === "ma_cross") return { kind, fastPeriod: 20, slowPeriod: 50, averageType: "SMA", rule: "cross_for_direction" };
  return { kind, period: 50, averageType: "EMA", target: "moving_average", rule: "cross_for_direction", level: 0 };
}
const defaultSignalGroup: EntryConditionGroup = { logic: "all", conditions: [{ kind: "ema", period: 400, rule: "with_direction" }, { kind: "stochastic", period: 15, signalPeriod: 2, slowPeriod: 9, rule: "extreme_for_direction", level: 20, upperLevel: 80 }] };
const defaultFirstEntryGroup: EntryConditionGroup = { logic: "all", conditions: [{ kind: "stochastic", period: 15, signalPeriod: 2, slowPeriod: 9, rule: "cross_for_direction", level: 20, upperLevel: 80 }] };
const defaults: Strategy = { schemaVersion: 1, strategyType: "gold_scalping_recovery", name: "Gold M5 · EMA400 + Stochastic", symbol: "XAUUSD", timeframe: "M5", direction: "both", entry: { type: "gold_stoch_pullback", fastPeriod: 20, slowPeriod: 50, maPeriod: 50, rsiPeriod: 14, rsiLow: 30, rsiHigh: 70, stochasticKPeriod: 15, stochasticDPeriod: 2, stochasticSlowing: 9, stochasticOversold: 20, stochasticOverbought: 80, emaFilterPeriod: 400, trigger: defaultEntryTrigger(), signalGroup: defaultSignalGroup }, manage: { lotSize: 0.01, maxPositions: 1, mode: "single", recovery: { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "candle", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, orderRules: Array.from({length:3},()=>({logic:"all",conditions:[{kind:"candle_reversal"}],trigger:defaultEntryTrigger()})) } }, exit: { stopLossPips: 30, takeProfitPips: 60, stopMode: "swing", swingLookbackBars: 10, swingBufferPoints: 0, riskRewardRatio: 1.5, basketStopLoss: 0, basketTakeProfit: 0 }, protection: { maxSpreadPoints: 30 } };
const recoveryPresets: { id: RecoveryPreset; title: string; description: string; details: string; signal: string }[] = [
  { id: "distance", title: "เพิ่มตามระยะ", description: "ราคาสวนทางครบระยะแล้วจึงเพิ่มไม้", details: "ใช้ระยะราคาเป็น trigger หลัก ไม่มีสัญญาณยืนยันเพิ่มเติม", signal: "Distance only" },
  { id: "candle", title: "รอแท่งยืนยัน", description: "ถึงระยะแล้วรอแท่งปิดยืนยันก่อนเพิ่ม", details: "ช่วยรอให้ราคาแสดงสัญญาณกลับทิศก่อนเปิดไม้แก้", signal: "Closed candle confirmation" },
  { id: "trend", title: "กรองด้วย Trend ใหญ่", description: "เพิ่มเมื่อ Trend Filter อนุญาต", details: "เลือกวิธีอ่านแนวโน้มและ timeframe กรองได้ หากยังไม่ยืนยัน ระบบจะรอ", signal: "Higher timeframe trend filter" },
  { id: "range", title: "เล่นกรอบ Sideway", description: "เพิ่มเมื่อราคาเริ่มกลับเข้ากรอบ", details: "รอสัญญาณกลับจากขอบกรอบหรือกลับเข้าช่องราคา และพักเมื่อกรอบแตก", signal: "Range re-entry / rejection" },
  { id: "atr", title: "ATR ปรับระยะ", description: "ปรับระยะตามความผันผวนและพักเมื่อ ATR ขยาย", details: "ATR ใช้กำหนดระยะและเป็น volatility gate ไม่ได้บอกทิศทางราคา", signal: "ATR spacing + volatility pause" },
  { id: "manual", title: "ยืนยันด้วยตนเอง", description: "ระบบรอให้คุณยืนยันก่อนเปิดไม้แก้", details: "เมื่อเงื่อนไขที่เลือกผ่าน ระบบจะแสดงสถานะรอยืนยัน แทนการเปิดทันที", signal: "Manual confirmation" },
];
const presetConditions: Record<Exclude<RecoveryPreset,"custom">, RecoveryConditionKind[]> = {
  distance: [], candle: ["candle_reversal"], trend: ["trend_filter"],
  range: ["range_reentry"], atr: ["atr_gate"], manual: ["manual_confirm"],
};
function newCondition(kind: RecoveryConditionKind): RecoveryCondition {
  return { kind, timeframe: "same", period: kind === "rsi_recovery" || kind === "atr_gate" ? 14 : undefined, level: kind === "rsi_recovery" ? 30 : undefined, method: kind === "trend_filter" ? "ema_slope" : kind === "range_reentry" ? "band_reentry" : undefined };
}
function makeOrderRules(preset: RecoveryPreset, count: number): AddOrderRule[] {
  const kinds = preset === "custom" ? [] : presetConditions[preset];
  return Array.from({ length: count }, () => ({ logic: "all" as const, conditions: kinds.map(newCondition), trigger: defaultEntryTrigger() }));
}
const exitRuleLabels: Record<ExitRuleKind, string> = {
  average_target: "เป้ากำไรจากราคาเฉลี่ย", trailing_average: "Trailing จากราคาเฉลี่ย", partial_close: "ทยอยปิดบางส่วน",
  time_limit: "ปิดเมื่อครบเวลา", signal_exit: "ปิดเมื่อสัญญาณกลับทิศ", manual_close: "รอผู้ใช้สั่งปิด",
};
const conditionLabels: Record<RecoveryConditionKind, string> = {
  candle_reversal: "แท่งกลับตัว / Rejection", trend_filter: "Trend Filter", range_reentry: "กลับเข้ากรอบ Sideway",
  atr_gate: "ATR / Volatility Gate", rsi_recovery: "RSI กลับผ่านระดับ", manual_confirm: "ผู้ใช้กดยืนยัน",
};
const entryModuleKinds: EntryModuleKind[] = ["ema", "stochastic", "rsi", "ma_cross", "price_cross"];
const storageKey = "easpaze.strategy.draft.v1";
function num(value: string) { return value === "" ? 0 : Number(value); }
const triggerKinds: { id: EntryTriggerKind; label: string }[] = [
  { id: "next_bar_open", label: "เข้าเมื่อต้นแท่งถัดไป" },
  { id: "break_signal_candle", label: "รอราคาทะลุ High/Low ของแท่งสัญญาณ" },
  { id: "pullback_to_ema", label: "รอราคาย่อกลับแตะ EMA" },
  { id: "candle_reversal", label: "รอแท่งยืนยันกลับทิศปิด" },
  { id: "manual", label: "รอผู้ใช้กดยืนยัน" },
];
function manageMode(s: Strategy): "single" | "recovery" {
  return s.manage.mode ?? (s.manage.recovery?.maxAdds || s.manage.maxPositions > 1 ? "recovery" : "single");
}
function hasManageOptions(s: Strategy) {
  return s.strategyType === "gold_scalping_recovery" || s.manage.mode !== undefined || s.manage.recovery !== undefined;
}
function usesBasketExit(s: Strategy) { return hasManageOptions(s) && manageMode(s) === "recovery"; }
function recoveryPreset(s: Strategy): RecoveryPreset { return s.manage.recovery?.preset ?? "distance"; }
function normalizeStrategy(s: Strategy): Strategy {
  const withTriggers = (strategy: Strategy): Strategy => {
    const recovery = strategy.manage.recovery;
    const legacySignal = strategy.entry.type === "ma_cross"
      ? [{ kind: "ma_cross" as const, fastPeriod: strategy.entry.fastPeriod, slowPeriod: strategy.entry.slowPeriod, averageType: "SMA" as const, rule: "cross_for_direction" }]
      : strategy.entry.type === "price_ma"
        ? [{ kind: "price_cross" as const, period: strategy.entry.maPeriod, averageType: "SMA" as const, target: "moving_average" as const, rule: "cross_for_direction" }]
        : strategy.entry.type === "rsi_recovery"
          ? [{ kind: "rsi" as const, period: strategy.entry.rsiPeriod, level: strategy.entry.rsiLow, upperLevel: strategy.entry.rsiHigh, rule: "recover_for_direction" }]
          : defaultSignalGroup.conditions;
    return {
      ...strategy,
      entry: {
        ...strategy.entry,
        signalGroup: strategy.entry.signalGroup ?? { logic: "all", conditions: legacySignal },
        ...(strategy.entry.firstEntryGroup ? { firstEntryGroup: strategy.entry.firstEntryGroup } : {}),
        stochasticKPeriod: strategy.entry.stochasticKPeriod ?? 15,
        stochasticDPeriod: strategy.entry.stochasticDPeriod ?? 2,
        stochasticSlowing: strategy.entry.stochasticSlowing ?? 9,
        stochasticOversold: strategy.entry.stochasticOversold ?? 20,
        stochasticOverbought: strategy.entry.stochasticOverbought ?? 80,
        emaFilterPeriod: strategy.entry.emaFilterPeriod ?? 400,
        trigger: strategy.entry.trigger ?? defaultEntryTrigger(),
      },
      manage: {
        ...strategy.manage,
        ...(recovery ? { recovery: { ...recovery, orderRules: (recovery.orderRules ?? makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds)).map(rule => ({ ...rule, trigger: rule.trigger ?? defaultEntryTrigger() })) } } : {}),
      },
    };
  };
  if (s.strategyType === "gold_scalping_recovery") {
    const recovery: RecoveryConfig = { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "distance", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, ...s.manage.recovery };
    recovery.orderRules ??= makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds);
    return withTriggers({ ...s, manage: { ...s.manage, mode: s.manage.mode ?? (recovery.maxAdds ? "recovery" : "single"), recovery } });
  }
  if (s.manage.mode !== undefined || s.manage.recovery !== undefined) {
    if (!s.manage.recovery) return withTriggers(s);
    const recovery: RecoveryConfig = { preset: "distance", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, ...s.manage.recovery };
    recovery.orderRules ??= makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds);
    return withTriggers({ ...s, manage: { ...s.manage, recovery } });
  }
  if (s.manage.maxPositions > 4) return withTriggers(s);
  const recovery: RecoveryConfig = { maxAdds: Math.max(0, s.manage.maxPositions - 1), spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "distance", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3 };
  recovery.orderRules = makeOrderRules("distance", recovery.maxAdds);
  return withTriggers({ ...s, manage: { ...s.manage, recovery } });
}
function validDraft(s: Strategy): string | null {
  if (!s.name.trim() || !s.symbol.trim()) return "กรุณาใส่ชื่อ Strategy และสัญลักษณ์ที่ต้องการเทรด";
  if (![s.entry.fastPeriod,s.entry.slowPeriod,s.entry.maPeriod,s.entry.rsiPeriod,s.manage.maxPositions].every(n => Number.isInteger(n) && n >= 1)) return "จำนวนช่วงและจำนวนไม้ต้องเป็นจำนวนเต็มอย่างน้อย 1";
  if (s.entry.type === "ma_cross" && s.entry.fastPeriod >= s.entry.slowPeriod) return "จำนวนช่วงของเส้นเร็วต้องน้อยกว่าเส้นช้า";
  if (!(s.entry.rsiLow > 0 && s.entry.rsiLow < s.entry.rsiHigh && s.entry.rsiHigh < 100)) return "ระดับ RSI ต้องมากกว่า 0 และน้อยกว่า 100 โดยระดับต่ำต้องน้อยกว่าระดับสูง";
  if (s.entry.type === "gold_stoch_pullback") {
    const { stochasticKPeriod = 15, stochasticDPeriod = 2, stochasticSlowing = 9, stochasticOversold = 20, stochasticOverbought = 80, emaFilterPeriod = 400 } = s.entry;
    if (![stochasticKPeriod,stochasticDPeriod,stochasticSlowing,emaFilterPeriod].every(n=>Number.isInteger(n)&&n>0)) return "ค่า period ของ EMA และ Stochastic ต้องเป็นจำนวนเต็มมากกว่า 0";
    if (!(stochasticOversold>0&&stochasticOversold<stochasticOverbought&&stochasticOverbought<100)) return "โซน Stochastic ต้องอยู่ระหว่าง 0–100 และระดับต่ำต้องน้อยกว่าระดับสูง";
  }
  const entryTrigger = s.entry.trigger ?? defaultEntryTrigger();
  if (!entryTriggerChoices.some(item=>item.id===entryTrigger.kind) || (entryTrigger.maxWaitBars!==undefined&&(!Number.isInteger(entryTrigger.maxWaitBars)||entryTrigger.maxWaitBars<1)) || (entryTrigger.bufferPoints!==undefined&&(!Number.isFinite(entryTrigger.bufferPoints)||entryTrigger.bufferPoints<0)) || (entryTrigger.emaPeriod!==undefined&&(!Number.isInteger(entryTrigger.emaPeriod)||entryTrigger.emaPeriod<1)) || (entryTrigger.delaySeconds!==undefined&&(!Number.isInteger(entryTrigger.delaySeconds)||entryTrigger.delaySeconds<1)) || (entryTrigger.priceMovePoints!==undefined&&(!Number.isFinite(entryTrigger.priceMovePoints)||entryTrigger.priceMovePoints<=0))) return "ตรวจสอบเงื่อนไขจังหวะเข้าไม้ที่สอง";
  if (s.entry.type === "gold_stoch_pullback" && ((s.exit.swingLookbackBars ?? 0) < 1 || !Number.isInteger(s.exit.swingLookbackBars) || (s.exit.swingBufferPoints ?? 0) < 0 || (s.exit.riskRewardRatio ?? 0) <= 0)) return "ตรวจสอบ Lookback, buffer และ Risk:Reward ของ Gold Strategy";
  if (s.entry.conditions && s.entry.conditions.some(condition => !Object.keys(conditionLabels).includes(condition.kind))) return "ตรวจสอบเงื่อนไขเข้าเทรดเพิ่มเติม";
  if (![s.manage.lotSize,s.protection.maxSpreadPoints].every(n => Number.isFinite(n) && n > 0)) return "Lot เริ่มต้นและ spread สูงสุดต้องมากกว่า 0";
  if (s.exit.closeRules && (!Array.isArray(s.exit.closeRules) || s.exit.closeRules.some(rule => !Object.keys(exitRuleLabels).includes(rule.kind) || (rule.value !== undefined && (!Number.isFinite(rule.value) || rule.value < 0)) || (rule.secondaryValue !== undefined && (!Number.isFinite(rule.secondaryValue) || rule.secondaryValue < 0))))) return "ตรวจสอบวิธีปิดเพิ่มเติมในขั้น Exit";
  if (hasManageOptions(s)) {
    const recovery = s.manage.recovery;
    if (s.manage.mode !== undefined && !["single","recovery"].includes(s.manage.mode)) return "เลือกรูปแบบการจัดการไม้ก่อนบันทึก";
    if (manageMode(s) === "single") {
      if (s.manage.maxPositions !== 1) return "โหมด Simple เปิดได้ครั้งละ 1 ไม้";
      if (![s.exit.stopLossPips,s.exit.takeProfitPips].every(n => Number.isFinite(n) && n > 0)) return "Stop Loss และ Take Profit ต้องมากกว่า 0";
    } else {
      if (!recovery || !Number.isInteger(recovery.maxAdds) || recovery.maxAdds < 1 || recovery.maxAdds > 3) return "เลือกจำนวนไม้แก้ตั้งแต่ 1 ถึง 3 ไม้";
      if (recovery.preset !== "custom" && !recoveryPresets.some(p => p.id === (recovery.preset ?? "distance"))) return "เลือกรูปแบบการเข้าไม้แก้ก่อนบันทึก";
      if (s.manage.maxPositions !== recovery.maxAdds + 1) return "จำนวนไม้รวมต้องเท่ากับไม้แรกบวกจำนวนไม้แก้";
      if (!Number.isFinite(recovery.spacingPoints) || recovery.spacingPoints < 0) return "ระยะเพิ่มไม้ต้องเป็น 0 หรือจำนวน points ที่มากกว่า 0";
      if (recovery.lotMode === "multiplier" && (!Number.isFinite(recovery.lotMultiplier) || recovery.lotMultiplier < 1)) return "ตัวคูณ lot ต้องไม่น้อยกว่า 1";
      if (!Number.isInteger(recovery.cooldownBars ?? 1) || (recovery.cooldownBars ?? 1) < 1) return "Cooldown ต้องเป็นอย่างน้อย 1 แท่ง";
      if (recovery.spacingMode === "atr" && (!Number.isFinite(recovery.atrPeriod) || (recovery.atrPeriod ?? 0) <= 0 || !Number.isFinite(recovery.atrMultiplier) || (recovery.atrMultiplier ?? 0) <= 0)) return "ตั้งค่า ATR period และ multiplier ให้มากกว่า 0";
      for (const rule of recovery.orderRules ?? []) {
        const trigger = rule.trigger ?? defaultEntryTrigger();
        if (!triggerKinds.some(item=>item.id===trigger.kind) || (trigger.maxWaitBars!==undefined&&(!Number.isInteger(trigger.maxWaitBars)||trigger.maxWaitBars<1)) || (trigger.bufferPoints!==undefined&&(!Number.isFinite(trigger.bufferPoints)||trigger.bufferPoints<0)) || (trigger.emaPeriod!==undefined&&(!Number.isInteger(trigger.emaPeriod)||trigger.emaPeriod<1))) return "ตรวจสอบจังหวะเข้าไม้แก้ในแต่ละลำดับ";
      }
      if ([s.exit.basketStopLoss ?? 0,s.exit.basketTakeProfit ?? 0].some(n => !Number.isFinite(n) || n < 0)) return "ค่า Basket TP/SL ต้องเป็น 0 หรือจำนวนเงินที่มากกว่า 0";
    }
  } else if (![s.exit.stopLossPips,s.exit.takeProfitPips].every(n => Number.isFinite(n) && n > 0)) return "Stop Loss และ Take Profit ต้องมากกว่า 0";
  return null;
}
function valid(s: Strategy): string | null {
  const draftError = validDraft(s);
  if (draftError) return draftError;
  for (const [label, group] of [["สัญญาณก่อนเข้าไม้", s.entry.signalGroup]] as const) {
    if (!group || group.conditions.length === 0) return `เพิ่มอย่างน้อย 1 เงื่อนไขในกลุ่ม${label}`;
    for (const condition of group.conditions) {
      const positiveIntegers = condition.kind === "ma_cross"
        ? [condition.fastPeriod, condition.slowPeriod]
        : condition.kind === "stochastic"
          ? [condition.period, condition.signalPeriod, condition.slowPeriod]
          : [condition.period];
      if (positiveIntegers.some(value => value !== undefined && (!Number.isInteger(value) || value < 1))) return `ตรวจสอบค่า Period ในกลุ่ม${label}`;
      if (condition.kind === "ma_cross" && (condition.fastPeriod ?? 0) >= (condition.slowPeriod ?? 0)) return "เส้นค่าเฉลี่ยเร็วต้องมี Period น้อยกว่าเส้นช้า";
      if ((condition.kind === "rsi" || condition.kind === "stochastic") && (![condition.level, condition.upperLevel].every(value => Number.isFinite(value) && (value ?? 0) > 0 && (value ?? 0) < 100) || (condition.level ?? 0) >= (condition.upperLevel ?? 100))) return `ระดับต่ำ/สูงของ ${moduleLabels[condition.kind]} ในกลุ่ม${label}ต้องอยู่ระหว่าง 0–100 และระดับต่ำต้องน้อยกว่าระดับสูง`;
      if (condition.kind === "price_cross" && condition.target === "price_level" && (!Number.isFinite(condition.level) || (condition.level ?? 0) <= 0)) return `กำหนดระดับราคาที่มากกว่า 0 ในกลุ่ม${label}`;
    }
  }
  if (usesBasketExit(s) && s.manage.recovery?.spacingMode !== "atr" && s.manage.recovery?.maxAdds && s.manage.recovery.spacingPoints <= 0) return "กำหนดระยะสวนทางก่อนเพิ่มไม้เป็น points ก่อนแชร์ Strategy";
  if (usesBasketExit(s)) {
    if ((s.exit.basketStopLoss ?? 0) <= 0 || (s.exit.basketTakeProfit ?? 0) <= 0) return "กำหนด Basket Stop Loss และ Basket Take Profit ก่อนแชร์ Strategy";
    for (const rule of s.exit.closeRules ?? []) {
      if ((rule.kind === "average_target" || rule.kind === "partial_close" || rule.kind === "time_limit") && (rule.value ?? 0) <= 0) return `กรอกค่าของวิธี “${exitRuleLabels[rule.kind]}” ก่อนแชร์ Strategy`;
      if (rule.kind === "partial_close" && (rule.value ?? 0) > 100) return "สัดส่วนปิดบางส่วนต้องไม่เกิน 100%";
      if (rule.kind === "trailing_average" && ((rule.value ?? 0) <= 0 || (rule.secondaryValue ?? 0) <= 0)) return "กรอกระยะเริ่ม Trailing และระยะตามราคาให้ครบก่อนแชร์ Strategy";
    }
  }
  return null;
}
function isDraft(value: unknown): value is Strategy {
  if (!value || typeof value !== "object") return false;
  const s = value as Strategy;
  return s.schemaVersion === 1 && (s.strategyType === undefined || s.strategyType === "gold_scalping_recovery") && typeof s.name === "string" && typeof s.symbol === "string" && ["M1","M5","M15","H1","H4","D1"].includes(s.timeframe) && ["both","buy","sell"].includes(s.direction) && !!s.entry && ["ma_cross","price_ma","rsi_recovery","gold_stoch_pullback"].includes(s.entry.type) && !!s.manage && !!s.exit && !!s.protection && !validDraft(s);
}

export default function Builder() {
  const [step, setStep] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>(() => normalizeStrategy(defaults));
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [signalModuleToAdd, setSignalModuleToAdd] = useState<EntryModuleKind>("rsi");
  const [entryStage, setEntryStage] = useState<"signal" | "trigger">("signal");
  useEffect(() => {
    let active = true;
    async function loadRemote() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const copyId = params.get("copy");
      const targetId = id ?? copyId;
      if (!targetId) return;
      const db = getSupabase(); if (!db) { setNotice("ยังไม่ได้เชื่อม Supabase จึงไม่สามารถเปิด Strategy ที่บันทึกในบัญชีได้"); return; }
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (!copyId && (authError || !user)) { setNotice("กรุณาเข้าสู่ระบบก่อนเปิด Strategy ที่บันทึกไว้"); return; }
      const {data,error} = await db.from("strategies").select("id,config,is_public").eq("id",targetId).maybeSingle();
      if (!active) return;
      if (error || !data || !isDraft(data.config) || (copyId && !data.is_public)) { setNotice("ไม่พบ Strategy หรือไม่สามารถอ่านข้อมูลนี้ได้"); return; }
      setStrategy(normalizeStrategy(data.config));
      if (copyId) {
        setStrategyId(null);
        setIsPublic(false);
        setNotice("คัดลอกมาเป็นแบบร่างส่วนตัวแล้ว ปรับแก้ก่อนบันทึกลงบัญชีได้เลย");
      } else {
        setStrategyId(data.id);
        setIsPublic(data.is_public ?? false);
        setNotice("เปิด Strategy จากบัญชีแล้ว");
      }
    }
    void loadRemote(); return () => { active = false; };
  }, []);
  async function saveRemote() {
    const draftError=validDraft(strategy); if(draftError){setNotice(draftError);return;}
    if(isPublic){const publishError=valid(strategy);if(publishError){setNotice(publishError);return;}}
    const db=getSupabase(); if(!db){setNotice("ยังไม่ได้เชื่อม Supabase คุณสามารถบันทึก Draft ในเบราว์เซอร์ได้ก่อน");return;}
    setRemoteBusy(true);
    try {
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError || !user){setNotice("กรุณาเข้าสู่ระบบก่อนบันทึกลงบัญชี");return;}
      const payload={name:strategy.name.trim(),config:strategy,is_public:isPublic};
      if(strategyId) {
        const {data,error}=await db.from("strategies").update(payload).eq("id",strategyId).select("id").maybeSingle();
        if(error || !data) throw new Error("update failed");
      } else {
        const {data,error}=await db.from("strategies").insert({...payload,owner_id:user.id}).select("id").single();
        if(error || !data) throw new Error("insert failed");
        setStrategyId(data.id);
        window.history.replaceState(null,"",`/build?id=${encodeURIComponent(data.id)}`);
      }
      setNotice(isPublic ? "บันทึกแล้ว · Strategy นี้แสดงใน Explore ให้ชุมชนเห็น" : "บันทึก Strategy ในบัญชีแล้ว · ยังเป็นส่วนตัว");
    } catch {setNotice("บันทึกลงบัญชีไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง");} finally {setRemoteBusy(false);}
  }
  const updateEntryGroup = (groupKey: "signalGroup" | "firstEntryGroup", patch: Partial<EntryConditionGroup>) => setStrategy(s => {
    const fallback = groupKey === "signalGroup" ? defaultSignalGroup : defaultFirstEntryGroup;
    return { ...s, entry: { ...s.entry, [groupKey]: { ...fallback, ...s.entry[groupKey], ...patch } } };
  });
  const updateEntryModule = (groupKey: "signalGroup" | "firstEntryGroup", index: number, module: EntryModule) => setStrategy(s => {
    const fallback = groupKey === "signalGroup" ? defaultSignalGroup : defaultFirstEntryGroup;
    const group = s.entry[groupKey] ?? fallback;
    return { ...s, entry: { ...s.entry, [groupKey]: { ...group, conditions: group.conditions.map((item, itemIndex) => itemIndex === index ? module : item) } } };
  });
  const addEntryModule = (groupKey: "signalGroup" | "firstEntryGroup", kind: EntryModuleKind) => setStrategy(s => {
    const fallback = groupKey === "signalGroup" ? defaultSignalGroup : defaultFirstEntryGroup;
    const group = s.entry[groupKey] ?? fallback;
    return { ...s, entry: { ...s.entry, [groupKey]: { ...group, conditions: [...group.conditions, newEntryModule(kind, groupKey === "signalGroup" ? "signal" : "entry")] } } };
  });
  const removeEntryModule = (groupKey: "signalGroup" | "firstEntryGroup", index: number) => setStrategy(s => {
    const fallback = groupKey === "signalGroup" ? defaultSignalGroup : defaultFirstEntryGroup;
    const group = s.entry[groupKey] ?? fallback;
    return { ...s, entry: { ...s.entry, [groupKey]: { ...group, conditions: group.conditions.filter((_, itemIndex) => itemIndex !== index) } } };
  });
  const updateRecovery = (patch: Partial<RecoveryConfig>) => setStrategy(s => {
    const current: RecoveryConfig = { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "candle", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, ...s.manage.recovery };
    const next: RecoveryConfig = { ...current, ...patch };
    if (patch.maxAdds !== undefined) {
      const rules = [...(next.orderRules ?? makeOrderRules(next.preset ?? "distance", next.maxAdds))];
      while (rules.length < next.maxAdds) rules.push({ logic: "all", conditions: (next.preset === "custom" ? [] : presetConditions[next.preset ?? "distance"]).map(newCondition), trigger: defaultEntryTrigger() });
      next.orderRules = rules.slice(0, next.maxAdds);
    }
    return { ...s, manage: { ...s.manage, ...(patch.maxAdds !== undefined ? { maxPositions: patch.maxAdds + 1 } : {}), recovery: next } };
  });
  const selectRecoveryPreset = (preset: RecoveryPreset) => {
    const count = strategy.manage.recovery?.maxAdds ?? 3;
    updateRecovery({ preset, orderRules: makeOrderRules(preset, count), spacingMode: preset === "atr" ? "atr" : "fixed" });
  };
  const updateOrderRule = (orderIndex: number, patch: Partial<AddOrderRule>) => setStrategy(s => {
    const recovery = s.manage.recovery;
    if (!recovery) return s;
    const orderRules = [...(recovery.orderRules ?? makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds))];
    orderRules[orderIndex] = { ...orderRules[orderIndex], ...patch };
    return { ...s, manage: { ...s.manage, recovery: { ...recovery, orderRules } } };
  });
  const updateOrderTrigger = (orderIndex: number, patch: Partial<EntryTrigger>) => setStrategy(s=>{
    const recovery=s.manage.recovery; if(!recovery)return s;
    const orderRules=[...(recovery.orderRules??makeOrderRules(recovery.preset??"distance",recovery.maxAdds))];
    const rule=orderRules[orderIndex]; orderRules[orderIndex]={...rule,trigger:{...defaultEntryTrigger(),...rule.trigger,...patch}};
    return {...s,manage:{...s.manage,recovery:{...recovery,orderRules}}};
  });
  const updateOrderCondition = (orderIndex: number, conditionIndex: number, condition: RecoveryCondition) => setStrategy(s => {
    const recovery = s.manage.recovery;
    if (!recovery) return s;
    const orderRules = [...(recovery.orderRules ?? makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds))];
    const rule = orderRules[orderIndex];
    orderRules[orderIndex] = { ...rule, conditions: rule.conditions.map((item, index) => index === conditionIndex ? condition : item) };
    return { ...s, manage: { ...s.manage, recovery: { ...recovery, orderRules } } };
  });
  const addOrderCondition = (orderIndex: number) => setStrategy(s => {
    const recovery = s.manage.recovery;
    if (!recovery) return s;
    const orderRules = [...(recovery.orderRules ?? makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds))];
    const rule = orderRules[orderIndex];
    orderRules[orderIndex] = { ...rule, conditions: [...rule.conditions, newCondition("candle_reversal")] };
    return { ...s, manage: { ...s.manage, recovery: { ...recovery, orderRules } } };
  });
  const removeOrderCondition = (orderIndex: number, conditionIndex: number) => setStrategy(s => {
    const recovery = s.manage.recovery;
    if (!recovery) return s;
    const orderRules = [...(recovery.orderRules ?? makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds))];
    const rule = orderRules[orderIndex];
    orderRules[orderIndex] = { ...rule, conditions: rule.conditions.filter((_, index) => index !== conditionIndex) };
    return { ...s, manage: { ...s.manage, recovery: { ...recovery, orderRules } } };
  });
  const updateExitRule = (index: number, patch: Partial<ExitRule>) => setStrategy(s => ({ ...s, exit: { ...s.exit, closeRules: (s.exit.closeRules ?? []).map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule) } }));
  const addExitRule = () => setStrategy(s => ({ ...s, exit: { ...s.exit, closeRules: [...(s.exit.closeRules ?? []), { kind: "average_target", value: 0 }] } }));
  const removeExitRule = (index: number) => setStrategy(s => ({ ...s, exit: { ...s.exit, closeRules: (s.exit.closeRules ?? []).filter((_, ruleIndex) => ruleIndex !== index) } }));
  const summarizeGroup = (group?: EntryConditionGroup) => group?.conditions.map(item => item.kind === "ema" ? `EMA ${item.period ?? 400}` : item.kind === "stochastic" ? `Stoch ${item.period ?? 15}/${item.signalPeriod ?? 2}/${item.slowPeriod ?? 9}` : item.kind === "rsi" ? `RSI ${item.period ?? 14}` : item.kind === "ma_cross" ? `${item.averageType ?? "SMA"} ${item.fastPeriod ?? 20}/${item.slowPeriod ?? 50} cross` : item.target === "price_level" ? `Price × ${item.level ?? "level"}` : `Price × ${item.averageType ?? "EMA"} ${item.period ?? 50}`).join(" + ") || "ยังไม่ตั้ง";
  const summary = `Setup: ${summarizeGroup(strategy.entry.signalGroup)} · Trigger: ${entryTriggerChoices.find(item=>item.id===(strategy.entry.trigger??defaultEntryTrigger()).kind)?.label ?? "เปิดแท่งถัดไป"}`;
  const exitSummary = usesBasketExit(strategy) ? `Basket SL ${strategy.exit.basketStopLoss || "ยังไม่ตั้ง"} · TP ${strategy.exit.basketTakeProfit || "ยังไม่ตั้ง"} · ${strategy.exit.closeRules?.length??0} วิธีเสริม` : strategy.entry.type === "gold_stoch_pullback" ? `SL Swing · TP ${strategy.exit.riskRewardRatio??1.5}R` : `SL ${strategy.exit.stopLossPips} / TP ${strategy.exit.takeProfitPips} pips`;
  function save() {
    const error = validDraft(strategy); if (error) { setNotice(error); return; }
    try { localStorage.setItem(storageKey, JSON.stringify(strategy)); setNotice("บันทึก draft ในเบราว์เซอร์นี้แล้ว"); setLoaded(true); } catch { setNotice("บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์"); }
  }
  function load() {
    try { const raw = localStorage.getItem(storageKey); if (!raw) { setNotice("ยังไม่มี draft ที่บันทึกในเบราว์เซอร์นี้"); return; } const data: unknown = JSON.parse(raw); if (!isDraft(data)) { setNotice("ไม่สามารถอ่าน draft นี้ได้ กรุณาสร้าง draft ใหม่"); return; } setStrategy(normalizeStrategy(data)); setStrategyId(null); setIsPublic(false); window.history.replaceState(null, "", "/build"); setNotice("โหลด draft ในเบราว์เซอร์แล้ว · บันทึกลงบัญชีเป็น Strategy ใหม่ได้"); setLoaded(true); } catch { setNotice("ไม่สามารถอ่าน draft จากเบราว์เซอร์นี้ได้"); }
  }
  const field = (label: string, value: number, onChange: (n: number) => void, suffix: string, min = 1, increment = 1) => <label className="builder-field"><span>{label}</span><span className="input-wrap"><input type="number" min={min} step={increment} value={value || ""} onChange={e => onChange(num(e.target.value))} /><small>{suffix}</small></span></label>;
  const entryModuleEditor = (module: EntryModule, onChange: (next: EntryModule) => void) => <>
    {module.kind === "ema" && <><div className="field-grid">{field("EMA Period",module.period??400,n=>onChange({...module,period:n}),"แท่ง",1)}<label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={module.rule??"with_direction"} onChange={e=>onChange({...module,rule:e.target.value})}><option value="with_direction">ราคาอยู่ฝั่งเดียวกับทิศทางเทรด</option><option value="price_above">ราคาปิดอยู่เหนือ EMA</option><option value="price_below">ราคาปิดอยู่ใต้ EMA</option><option value="slope_with_direction">ความชัน EMA ไปตามทิศทางเทรด</option></select></span></label></div><p className="module-hint">ตัวอย่าง: Buy ใช้ราคาเหนือ EMA และ Sell ใช้ราคาใต้ EMA เมื่อเลือกตามทิศทาง</p></>}
    {module.kind === "stochastic" && <><div className="field-grid">{field("%K Period",module.period??15,n=>onChange({...module,period:n}),"แท่ง",1)}{field("%D Period",module.signalPeriod??2,n=>onChange({...module,signalPeriod:n}),"แท่ง",1)}{field("Slowing",module.slowPeriod??9,n=>onChange({...module,slowPeriod:n}),"แท่ง",1)}<label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={module.rule??"cross_for_direction"} onChange={e=>onChange({...module,rule:e.target.value})}><option value="cross_for_direction">%K ตัด %D ตามทิศทาง</option><option value="extreme_for_direction">อยู่ในโซนต่ำ/สูงตามทิศทาง</option><option value="k_above_d">%K อยู่เหนือ %D</option><option value="k_below_d">%K อยู่ใต้ %D</option></select></span></label>{module.rule==="extreme_for_direction"&&<>{field("โซนต่ำ / Buy",module.level??20,n=>onChange({...module,level:n}),"0–100",1,1)}{field("โซนสูง / Sell",module.upperLevel??80,n=>onChange({...module,upperLevel:n}),"0–100",1,1)}</>}</div><p className="module-hint">ตั้งระดับโซน Buy และ Sell แยกกันได้</p></>}
    {module.kind === "rsi" && <><div className="field-grid">{field("RSI Period",module.period??14,n=>onChange({...module,period:n}),"แท่ง",1)}{field("ระดับต่ำ",module.level??30,n=>onChange({...module,level:n}),"0–100",1,1)}{field("ระดับสูง",module.upperLevel??70,n=>onChange({...module,upperLevel:n}),"0–100",1,1)}<label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={module.rule??"recover_for_direction"} onChange={e=>onChange({...module,rule:e.target.value})}><option value="recover_for_direction">กลับจากเขตต่ำ/สูงตามทิศทาง</option><option value="cross_above_level">ตัดขึ้นเหนือระดับต่ำ</option><option value="cross_below_level">ตัดลงต่ำกว่าระดับสูง</option><option value="above_level">อยู่เหนือระดับ</option><option value="below_level">อยู่ต่ำกว่าระดับ</option></select></span></label></div></>}
    {module.kind === "ma_cross" && <><div className="field-grid">{field("Period เส้นเร็ว",module.fastPeriod??20,n=>onChange({...module,fastPeriod:n}),"แท่ง",1)}{field("Period เส้นช้า",module.slowPeriod??50,n=>onChange({...module,slowPeriod:n}),"แท่ง",1)}<label className="builder-field"><span>ประเภทเส้น</span><span className="input-wrap"><select value={module.averageType??"SMA"} onChange={e=>onChange({...module,averageType:e.target.value as "SMA"|"EMA"})}><option value="SMA">SMA</option><option value="EMA">EMA</option></select></span></label><label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={module.rule??"cross_for_direction"} onChange={e=>onChange({...module,rule:e.target.value})}><option value="cross_for_direction">เส้นเร็วตัดตามทิศทางเทรด</option><option value="cross_up">เส้นเร็วตัดขึ้น</option><option value="cross_down">เส้นเร็วตัดลง</option></select></span></label></div></>}
    {module.kind === "price_cross" && <><div className="field-grid"><label className="builder-field"><span>ราคาตัดอะไร</span><span className="input-wrap"><select value={module.target??"moving_average"} onChange={e=>onChange({...module,target:e.target.value as EntryModule["target"]})}><option value="moving_average">เส้นค่าเฉลี่ย</option><option value="price_level">ระดับราคาที่กำหนด</option></select></span></label>{module.target==="price_level"?field("ระดับราคา",module.level??0,n=>onChange({...module,level:n}),"ราคา",0.01,0.01):<>{field("MA Period",module.period??50,n=>onChange({...module,period:n}),"แท่ง",1)}<label className="builder-field"><span>ประเภทเส้น</span><span className="input-wrap"><select value={module.averageType??"EMA"} onChange={e=>onChange({...module,averageType:e.target.value as "SMA"|"EMA"})}><option value="SMA">SMA</option><option value="EMA">EMA</option></select></span></label></>}<label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={module.rule??"cross_for_direction"} onChange={e=>onChange({...module,rule:e.target.value})}><option value="cross_for_direction">ราคาตัดตามทิศทางเทรด</option><option value="cross_up">ราคาตัดขึ้น</option><option value="cross_down">ราคาตัดลง</option></select></span></label></div></>}
  </>;
  const renderEntryGroup = (groupKey: "signalGroup" | "firstEntryGroup", title: string, description: string, moduleToAdd: EntryModuleKind, setModuleToAdd: (module: EntryModuleKind) => void) => {
    const fallback = groupKey === "signalGroup" ? defaultSignalGroup : defaultFirstEntryGroup;
    const group = strategy.entry[groupKey] ?? fallback;
    return <section className="entry-condition-group" aria-label={title}><div className="entry-group-heading"><div><span className="phase-label">{groupKey === "signalGroup" ? "จังหวะ 1 · Setup" : "จังหวะ 2 · Trigger"}</span><h3>{title}</h3><p>{description}</p></div><span className="module-count">{group.conditions.length} เงื่อนไข</span></div>
      <div className="field-grid entry-group-logic"><label className="builder-field"><span>รวมเงื่อนไข</span><span className="input-wrap"><select value={group.logic} onChange={e=>updateEntryGroup(groupKey,{logic:e.target.value as "all"|"any"})}><option value="all">ALL · ต้องผ่านทุกข้อ</option><option value="any">ANY · ผ่านข้อใดก็ได้</option></select></span></label></div>
      <div className="entry-module-list">{group.conditions.map((module,index)=><article className="entry-module-card" key={`${groupKey}-${index}`}><div className="condition-row-heading"><div><strong>{index+1}. {moduleLabels[module.kind]}</strong><small>หนึ่งโมดูลต่อหนึ่ง Indicator/กติกา</small></div><button type="button" className="remove-condition" onClick={()=>removeEntryModule(groupKey,index)}>ลบ</button></div>{entryModuleEditor(module,next=>updateEntryModule(groupKey,index,next))}</article>)}</div>
      <div className="entry-module-adder"><label className="builder-field"><span>เลือกโมดูลที่จะเพิ่ม</span><span className="input-wrap"><select value={moduleToAdd} onChange={e=>setModuleToAdd(e.target.value as EntryModuleKind)}>{entryModuleKinds.map(kind=><option key={kind} value={kind}>{moduleLabels[kind]}</option>)}</select></span></label><button type="button" className="add-condition-button" onClick={()=>addEntryModule(groupKey,moduleToAdd)}>＋ เพิ่มโมดูลในกลุ่มนี้</button></div>
    </section>;
  };
  const triggerSettings = (trigger: EntryTrigger, onChange: (patch: Partial<EntryTrigger>) => void) => <>
    <label className="builder-field"><span>เงื่อนไขจังหวะที่ 2 · เข้าไม้เมื่อ</span><span className="input-wrap"><select value={trigger.kind} onChange={e=>onChange({kind:e.target.value as EntryTriggerKind})}>{triggerKinds.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></span></label>
    {trigger.kind==="pullback_to_ema"&&field("EMA สำหรับรอจังหวะย่อ",trigger.emaPeriod??50,n=>onChange({emaPeriod:n}),"period",1)}
    {trigger.kind==="break_signal_candle"&&field("Buffer เหนือ/ใต้แท่งสัญญาณ",trigger.bufferPoints??0,n=>onChange({bufferPoints:n}),"points",0,0.1)}
    {trigger.kind!=="next_bar_open"&&trigger.kind!=="manual"&&field("ยกเลิกสัญญาณหลัง",trigger.maxWaitBars??3,n=>onChange({maxWaitBars:n}),"แท่ง",1)}
    {trigger.kind==="manual"&&field("ยกเลิกคำขอหลัง",trigger.maxWaitBars??3,n=>onChange({maxWaitBars:n}),"แท่ง",1)}
    <p className="signal-explanation">สัญญาณพร้อมแล้วจะรอเงื่อนไขนี้ก่อนเข้า · หากไม่เกิดภายในเวลาที่กำหนด ให้ยกเลิกสัญญาณเพื่อไม่ไล่ราคาทีหลัง</p>
  </>;
  const entryTriggerSettings = (trigger: EntryTrigger, onChange: (patch: Partial<EntryTrigger>) => void) => <section className="entry-condition-group entry-trigger-settings" aria-label="จังหวะเข้าไม้แรก">
    <div className="entry-group-heading"><div><span className="phase-label">จังหวะ 2 · Trigger</span><h3>เข้าไม้แรกเมื่อใด</h3><p>Setup ผ่านแล้ว จากนั้นใช้กติกานี้กำหนดจังหวะส่งคำสั่ง โดยไม่ต้องเพิ่ม Indicator ในขั้นนี้</p></div></div>
    <label className="builder-field"><span>เลือกรูปแบบจังหวะเข้า</span><span className="input-wrap"><select value={trigger.kind} onChange={e=>onChange({kind:e.target.value as EntryTriggerKind})}>{entryTriggerChoices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></span></label>
    <p className="trigger-description">{entryTriggerChoices.find(item=>item.id===trigger.kind)?.description}</p>
    {trigger.kind==="delay_seconds"&&field("หน่วงเวลาก่อนเข้า",trigger.delaySeconds??10,n=>onChange({delaySeconds:n}),"วินาที",1)}
    {trigger.kind==="price_move"&&<div className="field-grid">{field("ระยะจากจุด Setup",trigger.priceMovePoints??10,n=>onChange({priceMovePoints:n}),"points",0.1,0.1)}<label className="builder-field"><span>ทิศทางการขยับ</span><span className="input-wrap"><select value={trigger.moveDirection??"favorable"} onChange={e=>onChange({moveDirection:e.target.value as "favorable"|"adverse"})}><option value="favorable">ไปตามทิศทางเทรด</option><option value="adverse">สวนทางจากจุด Setup</option></select></span></label></div>}
    {trigger.kind==="pullback_to_ema"&&<div className="field-grid">{field("EMA สำหรับรอจังหวะย่อ",trigger.emaPeriod??50,n=>onChange({emaPeriod:n}),"period",1)}{field("Buffer จาก EMA",trigger.bufferPoints??0,n=>onChange({bufferPoints:n}),"points",0,0.1)}</div>}
    {trigger.kind==="break_signal_candle"&&field("Buffer เหนือ/ใต้แท่งสัญญาณ",trigger.bufferPoints??0,n=>onChange({bufferPoints:n}),"points",0,0.1)}
    {trigger.kind!=="immediate"&&trigger.kind!=="next_bar_open"&&field("ยกเลิกสัญญาณหลัง",trigger.maxWaitBars??3,n=>onChange({maxWaitBars:n}),"แท่ง",1)}
    <p className="signal-explanation">นี่คือภาพประกอบจากกราฟจำลองเท่านั้น · ระบบจริงต้องยกเลิกสัญญาณเมื่อหมดอายุหรือ Setup ไม่ผ่านแล้ว</p>
  </section>;
  return <div className="builder-page">
    <header className="builder-header"><Link href="/" className="builder-logo"><span>✳</span> EASpaze<span className="logo-period">.</span></Link><span className="header-divider" /><span className="header-title">Strategy Builder <small> / Draft</small></span><Link href="/" className="back-home">← กลับหน้าแรก</Link></header>
    <main className="builder-shell">
      <div className="builder-intro"><div><span className="builder-kicker">YOUR IDEAS START HERE</span><h1>มาสร้าง Strategy ของคุณกัน</h1><p>ค่อย ๆ ตั้งกติกาทีละขั้น เริ่มจากจังหวะเข้าเทรดที่คุณเข้าใจ</p></div><button type="button" onClick={load} className="builder-text-button">↻ โหลด draft ที่บันทึก</button></div>
      <div className="builder-layout"><div className="builder-main">
        <nav className="builder-steps" aria-label="ขั้นตอนการสร้างกลยุทธ์">{STEPS.map((name, i) => <button type="button" key={name} onClick={() => { setStep(i); setNotice(""); }} aria-current={i === step ? "step" : undefined} className={i === step ? "active" : ""}><span>{i + 1}</span><div><small>STEP 0{i + 1}</small><strong>{name}</strong></div></button>)}</nav>
        <section className="builder-panel">
          {step === 0 && <>
            <div className="panel-heading"><span className="panel-tag">STEP 01 · ENTRY</span><h2>ตั้งสัญญาณและจังหวะเข้าไม้แรก</h2><p>แบ่งการเข้าเป็นสองกลุ่มแยกกัน: กลุ่มแรกบอกว่ากลยุทธ์พร้อมแล้ว กลุ่มที่สองเป็นตัวกระตุ้นให้เข้าไม้แรก</p></div>
            <div className="entry-stage-tabs" role="tablist" aria-label="ขั้นตอนการตั้งค่า Entry">
              <button type="button" role="tab" aria-selected={entryStage==="signal"} className={entryStage==="signal"?"selected":""} onClick={()=>setEntryStage("signal")}><span>01</span><strong>Signal Setup</strong><small>สัญญาณ/Indicator ที่ต้องผ่าน</small></button>
              <button type="button" role="tab" aria-selected={entryStage==="trigger"} className={entryStage==="trigger"?"selected":""} onClick={()=>setEntryStage("trigger")}><span>02</span><strong>Entry Trigger</strong><small>จังหวะส่งคำสั่งหลัง Setup พร้อม</small></button>
            </div>
            <div className="entry-preview-layout"><div className="entry-config-stage">
              {entryStage==="signal" ? <>
                {renderEntryGroup("signalGroup", "สัญญาณก่อนเข้าไม้", "ใช้เป็น Setup หรือ Filter ก่อนเริ่มรอจังหวะเข้าไม้แรก", signalModuleToAdd, setSignalModuleToAdd)}
                <p className="signal-explanation">รวม Indicator ด้วย ALL ให้ผ่านทุกข้อ หรือ ANY ให้ผ่านข้อใดข้อหนึ่ง · ค่าตั้งต้น EMA + Stochastic ปรับแก้ได้</p>
                <a className="strategy-source" href="https://www.youtube.com/watch?v=AM5MGdbMbdo" target="_blank" rel="noreferrer">ที่มาของค่า EMA + Stochastic เริ่มต้น · ดูคลิป ↗</a>
                <div className="direction-group"><span>ทิศทางที่ต้องการเทรด</span><div>{([ ["both","Buy + Sell"],["buy","Buy เท่านั้น"],["sell","Sell เท่านั้น"] ] as const).map(([value,label])=><button key={value} type="button" className={strategy.direction === value ? "selected" : ""} aria-pressed={strategy.direction === value} onClick={()=>setStrategy(s=>({...s,direction:value}))}>{label}</button>)}</div></div>
              </> : entryTriggerSettings(strategy.entry.trigger??defaultEntryTrigger(),patch=>setStrategy(s=>({...s,entry:{...s.entry,trigger:{...(s.entry.trigger??defaultEntryTrigger()),...patch}}})))}
            </div><EntryPreviewChart strategy={strategy} stage={entryStage}/></div>
            <div className="builder-callout">รายการนี้เป็นการตั้งค่า Strategy บนเว็บ · EA ที่เชื่อมอยู่ในขณะนี้ยังเป็น Probe อ่านข้อมูลอย่างเดียว และยังไม่ส่งคำสั่งเทรด</div>
          </>}
          {step === 1 && hasManageOptions(strategy) && <>
            <div className="panel-heading"><span className="panel-tag">STEP 02 · MANAGE</span><h2>เลือกรูปแบบการออกไม้</h2><p>Strategy เดิมแก้ไขรูปแบบการจัดการไม้ได้ โดยยังคงค่า Entry และ Exit เดิมไว้</p></div>
            <div className="manage-mode-options" role="group" aria-label="รูปแบบการจัดการไม้">
              <button type="button" className={manageMode(strategy) === "single" ? "selected" : ""} aria-pressed={manageMode(strategy) === "single"} onClick={() => setStrategy(s => ({...s,manage:{...s.manage,mode:"single",maxPositions:1}}))}><span className="mode-indicator"/><span><strong>Simple · เข้าไม้เดียว</strong><small>เปิดครั้งเดียวตามสัญญาณ ใช้ TP/SL ปกติ ไม่มีไม้แก้</small></span></button>
              <button type="button" className={manageMode(strategy) === "recovery" ? "selected" : ""} aria-pressed={manageMode(strategy) === "recovery"} onClick={() => setStrategy(s => {const saved=s.manage.recovery ?? {maxAdds:3,spacingPoints:0,lotMode:"fixed" as LotMode,lotMultiplier:1,preset:"candle" as RecoveryPreset};const recovery=saved.maxAdds>0?saved:{...saved,maxAdds:3};return {...s,manage:{...s.manage,mode:"recovery",maxPositions:recovery.maxAdds+1,recovery}};})}><span className="mode-indicator"/><span><strong>Recovery · มีไม้แก้</strong><small>เลือกชุดสำเร็จและปรับเงื่อนไขการเพิ่มไม้ได้</small></span></button>
            </div>
            <div className="settings-box"><div className="settings-title">ค่าที่ใช้ร่วมกัน <span>ใช้ทั้ง Simple และ Recovery</span></div><div className="field-grid">{field("Lot เริ่มต้น",strategy.manage.lotSize,n=>setStrategy(s=>({...s,manage:{...s.manage,lotSize:n}})),"lot",0.01,0.01)}</div><p className="signal-explanation">Lot เริ่มต้นใช้กับไม้แรก · ขนาด lot ที่ใช้ได้จริงขึ้นอยู่กับข้อกำหนดของโบรกเกอร์และสินทรัพย์</p>
              {manageMode(strategy) === "single" ? <div className="mode-detail-note">Simple เปิดได้ครั้งละ 1 ไม้ ไม่เพิ่มไม้แก้ · ตั้ง TP/SL ของไม้ได้ในขั้น Exit</div> : <>
                <div className="recovery-preset-heading"><div><strong>เลือกชุด Recovery</strong><small>คลิกชุดที่ต้องการ แล้วปรับรายละเอียดด้านล่างได้</small></div><span>6 ชุด</span></div>
                <div className="recovery-preset-grid" role="group" aria-label="ชุดจัดการไม้แก้">{recoveryPresets.map((preset,index)=><button key={preset.id} type="button" className={`recovery-preset-card ${recoveryPreset(strategy)===preset.id?"selected":""}`} aria-pressed={recoveryPreset(strategy)===preset.id} onClick={()=>selectRecoveryPreset(preset.id)}><span className="preset-number">0{index+1}</span><span className="preset-radio"/><strong>{preset.title}</strong><small>{preset.description}</small></button>)}</div>
                <button type="button" className={`custom-recovery-button ${recoveryPreset(strategy)==="custom"?"selected":""}`} aria-pressed={recoveryPreset(strategy)==="custom"} onClick={()=>selectRecoveryPreset("custom")}><span>＋</span><span><strong>สร้างชุดเอง</strong><small>เริ่มจากเงื่อนไขพื้นฐาน แล้วเพิ่มหรือแก้กติกาของไม้แก้แต่ละลำดับ</small></span></button>
                <p className="signal-explanation">บันทึก Strategy ลงบัญชีเพื่อเก็บชุดนี้ไว้ หรือเปิดแชร์ใน Explore ให้คนอื่นคัดลอก Strategy ทั้งชุดพร้อมกติกา Entry, Recovery และ Exit</p>
                {(() => { const presetId=recoveryPreset(strategy); const preset=recoveryPresets.find(item=>item.id===presetId); const recovery=strategy.manage.recovery!; const presetTitle=preset?.title??"ชุดที่สร้างเอง"; const presetSignal=preset?.signal??"CUSTOM ENTRY RULES"; const presetDetails=preset?.details??"ปรับเงื่อนไขของไม้แก้แต่ละลำดับได้อย่างอิสระ และบันทึกเป็น Strategy ส่วนตัวหรือแชร์ใน Explore"; return <div className="preset-details"><div className="preset-details-heading"><span className="panel-tag">SELECTED · {presetSignal.toUpperCase()}</span><h3>{presetTitle}</h3><p>{presetDetails}</p></div>
                  <div className="field-grid recovery-fields"><label className="builder-field"><span>จำนวนไม้แก้สูงสุด</span><span className="input-wrap"><select value={recovery.maxAdds} onChange={e=>updateRecovery({maxAdds:num(e.target.value)})}><option value={1}>1 ไม้เพิ่ม</option><option value={2}>2 ไม้เพิ่ม</option><option value={3}>3 ไม้เพิ่ม</option></select></span></label><label className="builder-field"><span>วิธีคำนวณระยะ</span><span className="input-wrap"><select value={recovery.spacingMode??"fixed"} onChange={e=>updateRecovery({spacingMode:e.target.value as "fixed"|"atr"})}><option value="fixed">ระยะคงที่</option><option value="atr">อิง ATR</option></select></span></label>{recovery.spacingMode!=="atr"&&field("ระยะสวนทางก่อนเพิ่ม",recovery.spacingPoints,n=>updateRecovery({spacingPoints:n}),"points",0,1)}</div>
                  {recovery.spacingMode==="atr"&&<div className="field-grid recovery-fields">{field("ATR period",recovery.atrPeriod??14,n=>updateRecovery({atrPeriod:n}),"แท่ง",1)}{field("ตัวคูณ ATR",recovery.atrMultiplier??1,n=>updateRecovery({atrMultiplier:n}),"×",0.1,0.1)}</div>}
                  {presetId==="atr"&&<label className="preset-check"><input type="checkbox" checked={recovery.pauseOnAtrExpansion??true} onChange={e=>updateRecovery({pauseOnAtrExpansion:e.target.checked})}/><span><strong>พักการเพิ่มไม้เมื่อ ATR ขยายเร็ว</strong><small>ตัวเลือกนี้เป็นตัวกรองความผันผวน ไม่ได้ทำนายทิศทางราคา</small></span></label>}
                  {presetId==="manual"&&<div className="field-grid recovery-fields">{field("ยกเลิกคำขอหลัง",recovery.maxWaitBars??3,n=>updateRecovery({maxWaitBars:n}),"แท่ง",1)}</div>}
                  <div className="field-grid recovery-fields">{field("Cooldown ระหว่างไม้แก้",recovery.cooldownBars??1,n=>updateRecovery({cooldownBars:n}),"แท่ง",1)}</div>
                  <details className="advanced-settings"><summary>ปรับแต่งขั้นสูง · รูปแบบ Lot</summary><div className="field-grid"><label className="builder-field"><span>ขนาด Lot ของไม้แก้</span><span className="input-wrap"><select value={recovery.lotMode} onChange={e=>updateRecovery({lotMode:e.target.value as LotMode})}><option value="fixed">เท่ากับ Lot เริ่มต้น</option><option value="multiplier">คูณจากไม้ก่อนหน้า</option></select></span></label>{recovery.lotMode==="multiplier"&&field("ตัวคูณ Lot",recovery.lotMultiplier,n=>updateRecovery({lotMultiplier:n}),"×",1,0.1)}</div></details>
                  <p className="signal-explanation">Recovery จะรอให้ครบทั้ง trigger ระยะและ Safety Gate ก่อนเสมอ · Logic ALL/ANY ด้านล่างใช้กับสัญญาณเสริมเท่านั้น</p>
                  <div className="order-rules-heading"><div><strong>เงื่อนไขเข้าไม้แก้แต่ละลำดับ</strong><small>แต่ละไม้มีเงื่อนไขแยกกัน และเลือกเพิ่มหลายข้อได้</small></div></div>
                  <div className="add-order-rules">{Array.from({length:recovery.maxAdds},(_,orderIndex)=>{const rule=recovery.orderRules?.[orderIndex]??{logic:"all" as const,conditions:[],trigger:defaultEntryTrigger()};return <details className="add-order-rule" key={orderIndex} open={orderIndex===0}><summary><span>ไม้แก้ {orderIndex+1}</span><small>{rule.conditions.length===0?"ใช้ระยะและ Safety Gate":`${rule.conditions.length} เงื่อนไข · ${rule.logic==="all"?"ต้องผ่านทั้งหมด":"ผ่านข้อใดข้อหนึ่ง"}`}</small></summary><div className="order-rule-body"><div className="phase-label">จังหวะ 1 · รอสัญญาณพร้อมสำหรับไม้แก้</div><div className="field-grid"><label className="builder-field"><span>การรวมเงื่อนไขเสริม</span><span className="input-wrap"><select value={rule.logic} onChange={e=>updateOrderRule(orderIndex,{logic:e.target.value as "all"|"any"})}><option value="all">ALL · ต้องผ่านทุกข้อ</option><option value="any">ANY · ผ่านข้อใดก็ได้</option></select></span></label><div className="order-rule-required"><strong>เงื่อนไขบังคับ</strong><small>ระยะสวนทาง + Safety Gate</small></div></div>
                    {rule.conditions.map((condition,conditionIndex)=><div className="recovery-condition" key={`${orderIndex}-${conditionIndex}`}><div className="condition-row-heading"><strong>Condition {conditionIndex+1}</strong><button type="button" className="remove-condition" onClick={()=>removeOrderCondition(orderIndex,conditionIndex)}>ลบ</button></div><div className="field-grid"><label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={condition.kind} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,newCondition(e.target.value as RecoveryConditionKind))}>{Object.entries(conditionLabels).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></span></label>
                      {(condition.kind==="candle_reversal"||condition.kind==="trend_filter"||condition.kind==="range_reentry")&&<label className="builder-field"><span>Timeframe</span><span className="input-wrap"><select value={condition.timeframe??"same"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,timeframe:e.target.value})}><option value="same">ใช้ timeframe ของ Strategy</option><option value="M15">M15</option><option value="H1">H1</option><option value="H4">H4</option></select></span></label>}
                      {condition.kind==="trend_filter"&&<label className="builder-field"><span>วิธีกรอง Trend</span><span className="input-wrap"><select value={condition.method??"ema_slope"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,method:e.target.value})}><option value="ema_slope">ความชัน EMA</option><option value="ma_alignment">เส้นค่าเฉลี่ยเรียงตัว</option></select></span></label>}
                      {condition.kind==="range_reentry"&&<label className="builder-field"><span>รูปแบบสัญญาณ</span><span className="input-wrap"><select value={condition.method??"band_reentry"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,method:e.target.value})}><option value="band_reentry">ราคาปิดกลับเข้าช่อง</option><option value="boundary_rejection">ปฏิเสธบริเวณขอบกรอบ</option></select></span></label>}
                      {(condition.kind==="atr_gate"||condition.kind==="rsi_recovery")&&<>{field(condition.kind==="atr_gate"?"ATR period":"RSI period",condition.period??14,n=>updateOrderCondition(orderIndex,conditionIndex,{...condition,period:n}),"แท่ง",1)}{field(condition.kind==="atr_gate"?"ATR ratio threshold":"ระดับ RSI",condition.level??1,n=>updateOrderCondition(orderIndex,conditionIndex,{...condition,level:n}),condition.kind==="atr_gate"?"ratio":"ระดับ",0,0.1)}</>}
                      {condition.kind==="candle_reversal"&&<label className="builder-field"><span>การยืนยัน</span><span className="input-wrap"><select value={condition.method??"close_reversal"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,method:e.target.value})}><option value="close_reversal">รอแท่งปิดกลับทิศ</option><option value="rejection">แท่งปฏิเสธราคา</option></select></span></label>}
                    </div></div>)}
                    <button type="button" className="add-condition-button" onClick={()=>addOrderCondition(orderIndex)}>＋ เพิ่ม Condition ให้ไม้แก้ {orderIndex+1}</button><div className="order-trigger-stage"><div className="phase-label">จังหวะ 2 · เมื่อพร้อมแล้วจะเข้าไม้แก้เมื่อใด</div>{triggerSettings(rule.trigger??defaultEntryTrigger(),patch=>updateOrderTrigger(orderIndex,patch))}</div>
                  </div></details>})}</div>
                </div>; })()}
              </>}
            </div><div className="builder-callout">ค่าที่แสดงเป็นจุดเริ่มต้นสำหรับปรับแต่งและทดสอบ · การเพิ่มไม้ขณะขาดทุนเพิ่ม exposure · EA ที่เชื่อมอยู่ยังเป็น Probe อ่านอย่างเดียว ไม่มีคำสั่งซื้อขายหรือ Backtest</div>
          </>}
          {step === 2 && usesBasketExit(strategy) && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>เลือกวิธีปิดหรือคลายชุด</h2><p>ตั้งขีดจำกัด Basket TP/SL แล้วเพิ่มวิธีจัดการอื่นได้หลายข้อ · เงื่อนไขปิดเต็มชุดที่เกิดก่อนจะเป็นตัวปิดชุด</p></div>{strategy.entry.type==="gold_stoch_pullback"&&<div className="mode-detail-note">เมื่อเลือก Recovery ระบบจะใช้ Basket TP/SL ปิดทั้งชุด · SL จาก Swing High/Low และ TP แบบ Risk:Reward จะใช้กับโหมด Simple เท่านั้น</div>}<div className="settings-box"><div className="settings-title">ขีดจำกัดหลักของทั้งชุด <span>ใช้กับไม้แก้ทุกลำดับ</span></div><div className="field-grid">{field("ปิดทั้งชุดเมื่อกำไรถึง",strategy.exit.basketTakeProfit ?? 0,n=>setStrategy(s=>({...s,exit:{...s.exit,basketTakeProfit:n}})),"เงิน",0,0.01)}{field("ปิดทั้งชุดเมื่อขาดทุนถึง",strategy.exit.basketStopLoss ?? 0,n=>setStrategy(s=>({...s,exit:{...s.exit,basketStopLoss:n}})),"เงิน",0,0.01)}</div><p className="signal-explanation">Basket Stop Loss เป็นขอบเขตขาดทุนรวม ไม่ใช่ SL แยกรายออเดอร์ · กำหนด Basket TP/SL มากกว่า 0 ก่อนแชร์</p></div>
            <div className="exit-rules-panel"><div className="order-rules-heading"><div><strong>วิธีปิดเพิ่มเติม</strong><small>เพิ่มได้หลายข้อ · เงื่อนไขปิดเต็มชุดใช้แบบข้อใดเกิดก่อน</small></div></div>
              {(strategy.exit.closeRules??[]).map((rule,index)=><div className="exit-rule-card" key={`exit-${index}`}><div className="condition-row-heading"><strong>Exit Rule {index+1}</strong><button type="button" className="remove-condition" onClick={()=>removeExitRule(index)}>ลบ</button></div><label className="builder-field"><span>วิธีจัดการ</span><span className="input-wrap"><select value={rule.kind} onChange={e=>updateExitRule(index,{kind:e.target.value as ExitRuleKind,value:0,secondaryValue:0})}>{Object.entries(exitRuleLabels).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></span></label>
                {rule.kind==="average_target"&&<div className="field-grid exit-rule-fields">{field("เป้าจากราคาเฉลี่ย",rule.value??0,n=>updateExitRule(index,{value:n}),"points",0,1)}</div>}
                {rule.kind==="trailing_average"&&<div className="field-grid exit-rule-fields">{field("เริ่มเลื่อนเมื่อกำไรถึง",rule.value??0,n=>updateExitRule(index,{value:n}),"points",0,1)}{field("ระยะตามราคา",rule.secondaryValue??0,n=>updateExitRule(index,{secondaryValue:n}),"points",0,1)}</div>}
                {rule.kind==="partial_close"&&<div className="field-grid exit-rule-fields">{field("ปิดออกบางส่วน",rule.value??0,n=>updateExitRule(index,{value:n}),"%",1,1)}</div>}
                {rule.kind==="time_limit"&&<div className="field-grid exit-rule-fields">{field("ถือชุดได้นานสูงสุด",rule.value??0,n=>updateExitRule(index,{value:n}),"ชั่วโมง",1,1)}</div>}
                {rule.kind==="signal_exit"&&<div className="field-grid exit-rule-fields"><label className="builder-field"><span>Timeframe</span><span className="input-wrap"><select value={rule.timeframe??"same"} onChange={e=>updateExitRule(index,{timeframe:e.target.value})}><option value="same">ใช้ timeframe ของ Strategy</option><option value="M15">M15</option><option value="H1">H1</option><option value="H4">H4</option></select></span></label></div>}
                {rule.kind==="manual_close"&&<p className="signal-explanation">ชุดจะรอให้ผู้ใช้สั่งปิดเอง · Basket Stop Loss ยังทำหน้าที่เป็นขีดจำกัดหลัก</p>}
              </div>)}
              <button type="button" className="add-condition-button" onClick={addExitRule}>＋ เพิ่มวิธีปิดหรือจัดการชุด</button>
              <p className="signal-explanation">การปิดบางส่วนกับการปิดคู่/hedge ทำงานต่างกันตามประเภทบัญชี MT5; หน้านี้กำลังบันทึก config และยังไม่ส่งคำสั่งจริง</p>
            </div>
          </>}
          {step === 2 && !usesBasketExit(strategy) && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>ตั้ง TP และ SL ของไม้เดียว</h2><p>Simple เปิดออเดอร์ครั้งเดียวตาม Entry แล้วปิดเมื่อถึง Take Profit หรือ Stop Loss</p></div><div className="settings-box">{strategy.entry.type==="gold_stoch_pullback"?<><div className="field-grid"><label className="builder-field"><span>วิธีวาง Stop Loss</span><span className="input-wrap"><select value={strategy.exit.stopMode??"swing"} onChange={e=>setStrategy(s=>({...s,exit:{...s.exit,stopMode:e.target.value as "fixed_pips"|"swing"}}))}><option value="swing">จุด Swing High/Low ก่อนหน้า</option><option value="fixed_pips">ระยะคงที่</option></select></span></label>{strategy.exit.stopMode==="fixed_pips"?field("Stop Loss",strategy.exit.stopLossPips,n=>setStrategy(s=>({...s,exit:{...s.exit,stopLossPips:n}})),"pips"): <>{field("Lookback หา Swing",strategy.exit.swingLookbackBars??10,n=>setStrategy(s=>({...s,exit:{...s.exit,swingLookbackBars:n}})),"แท่งปิด",1)}{field("Buffer จาก Swing",strategy.exit.swingBufferPoints??0,n=>setStrategy(s=>({...s,exit:{...s.exit,swingBufferPoints:n}})),"points",0,0.1)}</>}{field("Risk : Reward",strategy.exit.riskRewardRatio??1.5,n=>setStrategy(s=>({...s,exit:{...s.exit,riskRewardRatio:n}})),"R",0.1,0.1)}</div><p className="signal-explanation">Buy: SL ต่ำกว่า Low ต่ำสุดใน Lookback · Sell: SL สูงกว่า High สูงสุด · TP คำนวณจากระยะ Entry ถึง SL × Risk:Reward · ค่าเริ่มต้น 1.5R ตามที่คุณดูจากคลิป</p><p className="signal-explanation">Lookback 10 แท่งและ Buffer 0 เป็นค่าเริ่มต้นสำหรับปรับแต่ง ไม่ใช่ตัวเลขที่ยืนยันจากคลิป</p></>:<><div className="field-grid">{field("Stop Loss",strategy.exit.stopLossPips,n=>setStrategy(s=>({...s,exit:{...s.exit,stopLossPips:n}})),"pips")}{field("Take Profit",strategy.exit.takeProfitPips,n=>setStrategy(s=>({...s,exit:{...s.exit,takeProfitPips:n}})),"pips")}</div><p className="signal-explanation">ค่า pip อาจต่างกันตามสัญลักษณ์และโบรกเกอร์ ควรตรวจสอบก่อนใช้งานจริง</p></>}</div></>}
          {step === 3 && <><div className="panel-heading"><span className="panel-tag">STEP 04 · PROTECTION</span><h2>ตั้งขอบเขตก่อนเริ่ม</h2><p>จำกัด spread สูงสุดที่ยอมรับได้ก่อนเปิดไม้ใหม่</p></div><div className="settings-box"><div className="field-grid">{field("Spread สูงสุด",strategy.protection.maxSpreadPoints,n=>setStrategy(s=>({...s,protection:{...s.protection,maxSpreadPoints:n}})),"points")}</div><p className="signal-explanation">เมื่อ spread เกินค่านี้ กติกาที่ตั้งไว้จะไม่เปิดไม้ใหม่ · points เป็นหน่วยของโบรกเกอร์ ไม่ใช่ pips เสมอไป</p></div><div className="builder-callout">✳ Template นี้เก็บค่า config บนเว็บเท่านั้น ตอนนี้ EA ที่เชื่อมอยู่เป็น Connectivity Probe แบบอ่านอย่างเดียว ยังไม่ส่งคำสั่งซื้อขายหรือ Backtest</div></>}
          <div className="panel-actions"><button type="button" className="button-back" onClick={()=>{setStep(Math.max(0,step-1));setNotice("");}} disabled={step===0}>← ย้อนกลับ</button>{step < 3 ? <button type="button" className="button-next" onClick={()=>{setStep(step+1);setNotice("");}}>ขั้นตอนถัดไป <span>→</span></button> : <button type="button" className="button-next" onClick={save}>บันทึก Draft <span>✓</span></button>}</div>
          {notice && <p className="builder-notice" role="status">{notice}</p>}
        </section>
      </div><aside className="builder-sidebar"><div className="sidebar-top"><span>YOUR STRATEGY</span><span className="draft-badge">● DEMO DRAFT</span></div><label className="sidebar-name">ชื่อ Strategy<input value={strategy.name} maxLength={80} onChange={e=>setStrategy(s=>({...s,name:e.target.value}))} /></label><div className="sidebar-fields"><label>สัญลักษณ์<input value={strategy.symbol} maxLength={20} onChange={e=>setStrategy(s=>({...s,symbol:e.target.value.toUpperCase()}))} /></label><label>Timeframe<select value={strategy.timeframe} onChange={e=>setStrategy(s=>({...s,timeframe:e.target.value}))}><option>M1</option><option>M5</option><option>M15</option><option>H1</option><option>H4</option><option>D1</option></select></label></div><div className="summary-list"><div><span>01 <b>Entry</b></span><strong>{summary}</strong></div><div><span>02 <b>Manage</b></span><strong>{hasManageOptions(strategy) ? manageMode(strategy) === "single" ? `${strategy.manage.lotSize} lot · Simple · 1 ไม้` : `${strategy.manage.lotSize} lot · ${recoveryPreset(strategy)==="custom"?"ชุด Custom":recoveryPresets.find(p=>p.id===recoveryPreset(strategy))?.title??"Recovery"} · แก้ ${strategy.manage.recovery?.maxAdds ?? 0} ไม้` : `${strategy.manage.lotSize} lot · สูงสุด ${strategy.manage.maxPositions} ไม้`}</strong></div><div><span>03 <b>Exit</b></span><strong>{exitSummary}</strong></div><div><span>04 <b>Protection</b></span><strong>Spread ไม่เกิน {strategy.protection.maxSpreadPoints} points</strong></div></div><label className="publish-toggle"><input type="checkbox" checked={isPublic} onChange={e=>{if(e.target.checked){const error=valid(strategy);if(error){setNotice(error);return;}}setIsPublic(e.target.checked);}} /><span><strong>แชร์ใน Explore</strong><small>{valid(strategy) ? "กรอกเงื่อนไข Manage และ TP/SL ให้ครบก่อนแชร์" : "ทุกคนจะเห็นกติกานี้และคัดลอกได้ · ผล Backtest ยังไม่ผ่านการยืนยัน"}</small></span></label><button type="button" className="account-save" disabled={remoteBusy} onClick={saveRemote}>{remoteBusy ? "กำลังบันทึก…" : strategyId ? "บันทึกการแก้ไขในบัญชี" : "บันทึก Draft ลงบัญชี"}</button><div className="sidebar-account-links"><Link href="/account">เข้าสู่ระบบ</Link><Link href="/strategies">My Strategies →</Link><Link href="/explore">Explore →</Link></div><div className="sidebar-foot"><span>✳</span><p>บันทึกเป็น Draft ได้โดยยังไม่กรอก TP/SL ครบ แต่การแชร์หรือส่งไป Backtest ยังทำไม่ได้ · EA ที่เชื่อมอยู่เป็น Probe อ่านอย่างเดียว{loaded ? " · โหลด Draft กลับมาแก้ไขได้" : ""}</p></div></aside></div>
      <p className="builder-footer">EASpaze · สร้างอย่างเข้าใจ ทดลองอย่างรอบคอบ</p>
    </main>
  </div>;
}
