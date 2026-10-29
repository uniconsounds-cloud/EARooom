"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const STEPS = ["Entry", "Manage", "Exit", "Protection"] as const;
type Entry = "ma_cross" | "price_ma" | "rsi_recovery";
type Direction = "both" | "buy" | "sell";
type LotMode = "fixed" | "multiplier";
type RecoveryPreset = "distance" | "candle" | "trend" | "range" | "atr" | "manual" | "custom";
type RecoveryConditionKind = "candle_reversal" | "trend_filter" | "range_reentry" | "atr_gate" | "rsi_recovery" | "manual_confirm";
type RecoveryCondition = { kind: RecoveryConditionKind; timeframe?: string; period?: number; level?: number; method?: string };
type AddOrderRule = { logic: "all" | "any"; conditions: RecoveryCondition[] };
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
type Strategy = {
  schemaVersion: 1; strategyType?: "gold_scalping_recovery"; name: string; symbol: string; timeframe: string; direction: Direction;
  entry: { type: Entry; fastPeriod: number; slowPeriod: number; maPeriod: number; rsiPeriod: number; rsiLow: number; rsiHigh: number };
  manage: { lotSize: number; maxPositions: number; mode?: "single" | "recovery"; recovery?: RecoveryConfig };
  exit: { stopLossPips: number; takeProfitPips: number; basketStopLoss?: number; basketTakeProfit?: number; closeRules?: ExitRule[] };
  protection: { maxSpreadPoints: number };
};
const defaults: Strategy = { schemaVersion: 1, strategyType: "gold_scalping_recovery", name: "Gold Scalping · Demo", symbol: "XAUUSD.v", timeframe: "M5", direction: "both", entry: { type: "ma_cross", fastPeriod: 20, slowPeriod: 50, maPeriod: 50, rsiPeriod: 14, rsiLow: 30, rsiHigh: 70 }, manage: { lotSize: 0.01, maxPositions: 1, mode: "single", recovery: { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "candle", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3 } }, exit: { stopLossPips: 30, takeProfitPips: 60, basketStopLoss: 0, basketTakeProfit: 0 }, protection: { maxSpreadPoints: 30 } };
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
  return Array.from({ length: count }, () => ({ logic: "all" as const, conditions: kinds.map(newCondition) }));
}
const exitRuleLabels: Record<ExitRuleKind, string> = {
  average_target: "เป้ากำไรจากราคาเฉลี่ย", trailing_average: "Trailing จากราคาเฉลี่ย", partial_close: "ทยอยปิดบางส่วน",
  time_limit: "ปิดเมื่อครบเวลา", signal_exit: "ปิดเมื่อสัญญาณกลับทิศ", manual_close: "รอผู้ใช้สั่งปิด",
};
const conditionLabels: Record<RecoveryConditionKind, string> = {
  candle_reversal: "แท่งกลับตัว / Rejection", trend_filter: "Trend Filter", range_reentry: "กลับเข้ากรอบ Sideway",
  atr_gate: "ATR / Volatility Gate", rsi_recovery: "RSI กลับผ่านระดับ", manual_confirm: "ผู้ใช้กดยืนยัน",
};
const choices: { id: Entry; title: string; label: string; description: string }[] = [
  { id: "ma_cross", title: "เส้นค่าเฉลี่ยตัดกัน", label: "MOVING AVERAGE CROSS", description: "ดูจังหวะที่เส้นเร็วตัดเส้นช้า เพื่อจับการเปลี่ยนทิศทาง" },
  { id: "price_ma", title: "ราคาตัดเส้นค่าเฉลี่ย", label: "PRICE CROSSES MA", description: "รอให้ราคาปิดข้ามเส้นค่าเฉลี่ย เพื่อดูการเปลี่ยนฝั่งของราคา" },
  { id: "rsi_recovery", title: "RSI กลับผ่านระดับ", label: "RSI RECOVERY", description: "รอ RSI กลับผ่านระดับที่ตั้งไว้ หลังอยู่ในเขตต่ำหรือสูง" },
];
const storageKey = "easpaze.strategy.draft.v1";
function num(value: string) { return value === "" ? 0 : Number(value); }
function manageMode(s: Strategy): "single" | "recovery" {
  return s.manage.mode ?? (s.manage.recovery?.maxAdds || s.manage.maxPositions > 1 ? "recovery" : "single");
}
function hasManageOptions(s: Strategy) {
  return s.strategyType === "gold_scalping_recovery" || s.manage.mode !== undefined || s.manage.recovery !== undefined;
}
function usesBasketExit(s: Strategy) { return hasManageOptions(s) && manageMode(s) === "recovery"; }
function recoveryPreset(s: Strategy): RecoveryPreset { return s.manage.recovery?.preset ?? "distance"; }
function normalizeStrategy(s: Strategy): Strategy {
  if (s.strategyType === "gold_scalping_recovery") {
    const recovery: RecoveryConfig = { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "distance", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, ...s.manage.recovery };
    recovery.orderRules ??= makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds);
    return { ...s, manage: { ...s.manage, mode: s.manage.mode ?? (recovery.maxAdds ? "recovery" : "single"), recovery } };
  }
  if (s.manage.mode !== undefined || s.manage.recovery !== undefined) {
    if (!s.manage.recovery) return s;
    const recovery: RecoveryConfig = { preset: "distance", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, ...s.manage.recovery };
    recovery.orderRules ??= makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds);
    return { ...s, manage: { ...s.manage, recovery } };
  }
  if (s.manage.maxPositions > 4) return s;
  const recovery: RecoveryConfig = { maxAdds: Math.max(0, s.manage.maxPositions - 1), spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "distance", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3 };
  recovery.orderRules = makeOrderRules("distance", recovery.maxAdds);
  return { ...s, manage: { ...s.manage, recovery } };
}
function validDraft(s: Strategy): string | null {
  if (!s.name.trim() || !s.symbol.trim()) return "กรุณาใส่ชื่อ Strategy และสัญลักษณ์ที่ต้องการเทรด";
  if (![s.entry.fastPeriod,s.entry.slowPeriod,s.entry.maPeriod,s.entry.rsiPeriod,s.manage.maxPositions].every(n => Number.isInteger(n) && n >= 1)) return "จำนวนช่วงและจำนวนไม้ต้องเป็นจำนวนเต็มอย่างน้อย 1";
  if (s.entry.type === "ma_cross" && s.entry.fastPeriod >= s.entry.slowPeriod) return "จำนวนช่วงของเส้นเร็วต้องน้อยกว่าเส้นช้า";
  if (!(s.entry.rsiLow > 0 && s.entry.rsiLow < s.entry.rsiHigh && s.entry.rsiHigh < 100)) return "ระดับ RSI ต้องมากกว่า 0 และน้อยกว่า 100 โดยระดับต่ำต้องน้อยกว่าระดับสูง";
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
      if (recovery.preset === "atr" && (!Number.isFinite(recovery.atrPeriod) || (recovery.atrPeriod ?? 0) <= 0 || !Number.isFinite(recovery.atrMultiplier) || (recovery.atrMultiplier ?? 0) <= 0)) return "ตั้งค่า ATR period และ multiplier ให้มากกว่า 0";
      if ([s.exit.basketStopLoss ?? 0,s.exit.basketTakeProfit ?? 0].some(n => !Number.isFinite(n) || n < 0)) return "ค่า Basket TP/SL ต้องเป็น 0 หรือจำนวนเงินที่มากกว่า 0";
    }
  } else if (![s.exit.stopLossPips,s.exit.takeProfitPips].every(n => Number.isFinite(n) && n > 0)) return "Stop Loss และ Take Profit ต้องมากกว่า 0";
  return null;
}
function valid(s: Strategy): string | null {
  const draftError = validDraft(s);
  if (draftError) return draftError;
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
  return s.schemaVersion === 1 && (s.strategyType === undefined || s.strategyType === "gold_scalping_recovery") && typeof s.name === "string" && typeof s.symbol === "string" && ["M1","M5","M15","H1","H4","D1"].includes(s.timeframe) && ["both","buy","sell"].includes(s.direction) && !!s.entry && ["ma_cross","price_ma","rsi_recovery"].includes(s.entry.type) && !!s.manage && !!s.exit && !!s.protection && !validDraft(s);
}

export default function Builder() {
  const [step, setStep] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>(() => normalizeStrategy(defaults));
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState(false);
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
  const updateEntry = (key: keyof Strategy["entry"], value: string | number) => setStrategy(s => ({ ...s, entry: { ...s.entry, [key]: value } }));
  const updateRecovery = (patch: Partial<RecoveryConfig>) => setStrategy(s => {
    const current: RecoveryConfig = { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1, preset: "candle", spacingMode: "fixed", cooldownBars: 1, confirmationTimeframe: "same", trendFilter: "ema_slope", rangeSignal: "band_reentry", atrPeriod: 14, atrMultiplier: 1, pauseOnAtrExpansion: true, maxWaitBars: 3, ...s.manage.recovery };
    const next: RecoveryConfig = { ...current, ...patch };
    if (patch.maxAdds !== undefined) {
      const rules = [...(next.orderRules ?? makeOrderRules(next.preset ?? "distance", next.maxAdds))];
      while (rules.length < next.maxAdds) rules.push({ logic: "all", conditions: (next.preset === "custom" ? [] : presetConditions[next.preset ?? "distance"]).map(newCondition) });
      next.orderRules = rules.slice(0, next.maxAdds);
    }
    return { ...s, manage: { ...s.manage, ...(patch.maxAdds !== undefined ? { maxPositions: patch.maxAdds + 1 } : {}), recovery: next } };
  });
  const selectRecoveryPreset = (preset: RecoveryPreset) => {
    const count = strategy.manage.recovery?.maxAdds ?? 3;
    updateRecovery({ preset, orderRules: makeOrderRules(preset, count), ...(preset === "atr" ? { spacingMode: "atr" } : {}) });
  };
  const updateOrderRule = (orderIndex: number, patch: Partial<AddOrderRule>) => setStrategy(s => {
    const recovery = s.manage.recovery;
    if (!recovery) return s;
    const orderRules = [...(recovery.orderRules ?? makeOrderRules(recovery.preset ?? "distance", recovery.maxAdds))];
    orderRules[orderIndex] = { ...orderRules[orderIndex], ...patch };
    return { ...s, manage: { ...s.manage, recovery: { ...recovery, orderRules } } };
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
  const summary = strategy.entry.type === "ma_cross" ? `SMA ${strategy.entry.fastPeriod} ตัด SMA ${strategy.entry.slowPeriod}` : strategy.entry.type === "price_ma" ? `ราคาปิดตัด SMA ${strategy.entry.maPeriod}` : `RSI ${strategy.entry.rsiPeriod} กลับผ่าน ${strategy.entry.rsiLow} / ${strategy.entry.rsiHigh}`;
  function save() {
    const error = validDraft(strategy); if (error) { setNotice(error); return; }
    try { localStorage.setItem(storageKey, JSON.stringify(strategy)); setNotice("บันทึก draft ในเบราว์เซอร์นี้แล้ว"); setLoaded(true); } catch { setNotice("บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์"); }
  }
  function load() {
    try { const raw = localStorage.getItem(storageKey); if (!raw) { setNotice("ยังไม่มี draft ที่บันทึกในเบราว์เซอร์นี้"); return; } const data: unknown = JSON.parse(raw); if (!isDraft(data)) { setNotice("ไม่สามารถอ่าน draft นี้ได้ กรุณาสร้าง draft ใหม่"); return; } setStrategy(normalizeStrategy(data)); setStrategyId(null); setIsPublic(false); window.history.replaceState(null, "", "/build"); setNotice("โหลด draft ในเบราว์เซอร์แล้ว · บันทึกลงบัญชีเป็น Strategy ใหม่ได้"); setLoaded(true); } catch { setNotice("ไม่สามารถอ่าน draft จากเบราว์เซอร์นี้ได้"); }
  }
  const field = (label: string, value: number, onChange: (n: number) => void, suffix: string, min = 1, increment = 1) => <label className="builder-field"><span>{label}</span><span className="input-wrap"><input type="number" min={min} step={increment} value={value || ""} onChange={e => onChange(num(e.target.value))} /><small>{suffix}</small></span></label>;
  return <div className="builder-page">
    <header className="builder-header"><Link href="/" className="builder-logo"><span>✳</span> EASpaze<span className="logo-period">.</span></Link><span className="header-divider" /><span className="header-title">Strategy Builder <small> / Draft</small></span><Link href="/" className="back-home">← กลับหน้าแรก</Link></header>
    <main className="builder-shell">
      <div className="builder-intro"><div><span className="builder-kicker">YOUR IDEAS START HERE</span><h1>มาสร้าง Strategy ของคุณกัน</h1><p>ค่อย ๆ ตั้งกติกาทีละขั้น เริ่มจากจังหวะเข้าเทรดที่คุณเข้าใจ</p></div><button type="button" onClick={load} className="builder-text-button">↻ โหลด draft ที่บันทึก</button></div>
      <div className="builder-layout"><div className="builder-main">
        <nav className="builder-steps" aria-label="ขั้นตอนการสร้างกลยุทธ์">{STEPS.map((name, i) => <button type="button" key={name} onClick={() => { setStep(i); setNotice(""); }} aria-current={i === step ? "step" : undefined} className={i === step ? "active" : ""}><span>{i + 1}</span><div><small>STEP 0{i + 1}</small><strong>{name}</strong></div></button>)}</nav>
        <section className="builder-panel">
          {step === 0 && <><div className="panel-heading"><span className="panel-tag">TEMPLATE 01 · GOLD SCALPING + RECOVERY</span><h2>เริ่มเข้าเทรดเมื่อไหร่?</h2><p>เลือกสัญญาณเข้าได้หนึ่งแบบ ตั้งให้เข้า Market เมื่อสัญญาณเกิดและตรงกับทิศทางที่เลือก · ยังไม่เชื่อมกับ EA ที่ส่งคำสั่ง</p></div>
            <div className="entry-options">{choices.map(c => <button key={c.id} type="button" aria-pressed={strategy.entry.type === c.id} className={`entry-option ${strategy.entry.type === c.id ? "selected" : ""}`} onClick={() => updateEntry("type", c.id)}><span className="option-radio" /><span><small>{c.label}</small><strong>{c.title}</strong><em>{c.description}</em></span></button>)}</div>
            <div className="settings-box"><div className="settings-title">ตั้งค่าเงื่อนไข <span>ปรับได้ตามไอเดียของคุณ</span></div>
              {strategy.entry.type === "ma_cross" && <><div className="field-grid">{field("เส้นเร็ว (SMA)",strategy.entry.fastPeriod,n=>updateEntry("fastPeriod",n),"แท่ง")}{field("เส้นช้า (SMA)",strategy.entry.slowPeriod,n=>updateEntry("slowPeriod",n),"แท่ง")}</div><p className="signal-explanation">Buy เมื่อเส้นเร็วตัดขึ้นเหนือเส้นช้า · Sell เมื่อเส้นเร็วตัดลงต่ำกว่าเส้นช้า</p></>}
              {strategy.entry.type === "price_ma" && <><div className="field-grid">{field("เส้นค่าเฉลี่ย (SMA)",strategy.entry.maPeriod,n=>updateEntry("maPeriod",n),"แท่ง")}</div><p className="signal-explanation">Buy เมื่อราคาปิดตัดขึ้นเหนือ SMA · Sell เมื่อราคาปิดตัดลงต่ำกว่า SMA</p></>}
              {strategy.entry.type === "rsi_recovery" && <><div className="field-grid">{field("ช่วง RSI",strategy.entry.rsiPeriod,n=>updateEntry("rsiPeriod",n),"แท่ง")}{field("ระดับต่ำ",strategy.entry.rsiLow,n=>updateEntry("rsiLow",n),"RSI")}{field("ระดับสูง",strategy.entry.rsiHigh,n=>updateEntry("rsiHigh",n),"RSI")}</div><p className="signal-explanation">Buy เมื่อ RSI ตัดขึ้นผ่านระดับต่ำ · Sell เมื่อ RSI ตัดลงผ่านระดับสูง</p></>}
            </div><div className="direction-group"><span>ทิศทางที่ต้องการเทรด</span><div>{([ ["both","Buy + Sell"],["buy","Buy เท่านั้น"],["sell","Sell เท่านั้น"] ] as const).map(([value,label])=><button key={value} type="button" className={strategy.direction === value ? "selected" : ""} aria-pressed={strategy.direction === value} onClick={()=>setStrategy(s=>({...s,direction:value}))}>{label}</button>)}</div></div></>}
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
                {(() => { const presetId=recoveryPreset(strategy); const preset=recoveryPresets.find(item=>item.id===presetId); const recovery=strategy.manage.recovery!; const presetTitle=preset?.title??"ชุดที่สร้างเอง"; const presetSignal=preset?.signal??"CUSTOM ENTRY RULES"; const presetDetails=preset?.details??"ปรับเงื่อนไขของไม้แก้แต่ละลำดับได้อย่างอิสระ และบันทึกเป็น Strategy ส่วนตัวหรือแชร์ใน Explore"; return <div className="preset-details"><div className="preset-details-heading"><span className="panel-tag">SELECTED · {presetSignal.toUpperCase()}</span><h3>{presetTitle}</h3><p>{presetDetails}</p></div>
                  <div className="field-grid recovery-fields"><label className="builder-field"><span>จำนวนไม้แก้สูงสุด</span><span className="input-wrap"><select value={recovery.maxAdds} onChange={e=>updateRecovery({maxAdds:num(e.target.value)})}><option value={1}>1 ไม้เพิ่ม</option><option value={2}>2 ไม้เพิ่ม</option><option value={3}>3 ไม้เพิ่ม</option></select></span></label><label className="builder-field"><span>วิธีคำนวณระยะ</span><span className="input-wrap"><select value={recovery.spacingMode??"fixed"} onChange={e=>updateRecovery({spacingMode:e.target.value as "fixed"|"atr"})}><option value="fixed">ระยะคงที่</option><option value="atr">อิง ATR</option></select></span></label>{recovery.spacingMode!=="atr"&&field("ระยะสวนทางก่อนเพิ่ม",recovery.spacingPoints,n=>updateRecovery({spacingPoints:n}),"points",0,1)}</div>
                  {recovery.spacingMode==="atr"&&<div className="field-grid recovery-fields">{field("ATR period",recovery.atrPeriod??14,n=>updateRecovery({atrPeriod:n}),"แท่ง",1)}{field("ตัวคูณ ATR",recovery.atrMultiplier??1,n=>updateRecovery({atrMultiplier:n}),"×",0.1,0.1)}</div>}
                  {presetId==="atr"&&<label className="preset-check"><input type="checkbox" checked={recovery.pauseOnAtrExpansion??true} onChange={e=>updateRecovery({pauseOnAtrExpansion:e.target.checked})}/><span><strong>พักการเพิ่มไม้เมื่อ ATR ขยายเร็ว</strong><small>ตัวเลือกนี้เป็นตัวกรองความผันผวน ไม่ได้ทำนายทิศทางราคา</small></span></label>}
                  {presetId==="manual"&&<div className="field-grid recovery-fields">{field("ยกเลิกคำขอหลัง",recovery.maxWaitBars??3,n=>updateRecovery({maxWaitBars:n}),"แท่ง",1)}</div>}
                  <div className="field-grid recovery-fields">{field("Cooldown ระหว่างไม้แก้",recovery.cooldownBars??1,n=>updateRecovery({cooldownBars:n}),"แท่ง",1)}</div>
                  <details className="advanced-settings"><summary>ปรับแต่งขั้นสูง · รูปแบบ Lot</summary><div className="field-grid"><label className="builder-field"><span>ขนาด Lot ของไม้แก้</span><span className="input-wrap"><select value={recovery.lotMode} onChange={e=>updateRecovery({lotMode:e.target.value as LotMode})}><option value="fixed">เท่ากับ Lot เริ่มต้น</option><option value="multiplier">คูณจากไม้ก่อนหน้า</option></select></span></label>{recovery.lotMode==="multiplier"&&field("ตัวคูณ Lot",recovery.lotMultiplier,n=>updateRecovery({lotMultiplier:n}),"×",1,0.1)}</div></details>
                  <p className="signal-explanation">Recovery จะรอให้ครบทั้ง trigger ระยะและ Safety Gate ก่อนเสมอ · Logic ALL/ANY ด้านล่างใช้กับสัญญาณเสริมเท่านั้น</p>
                  <div className="order-rules-heading"><div><strong>เงื่อนไขเข้าไม้แก้แต่ละลำดับ</strong><small>แต่ละไม้มีเงื่อนไขแยกกัน และเลือกเพิ่มหลายข้อได้</small></div></div>
                  <div className="add-order-rules">{Array.from({length:recovery.maxAdds},(_,orderIndex)=>{const rule=recovery.orderRules?.[orderIndex]??{logic:"all" as const,conditions:[]};return <details className="add-order-rule" key={orderIndex} open={orderIndex===0}><summary><span>ไม้แก้ {orderIndex+1}</span><small>{rule.conditions.length===0?"ใช้ระยะและ Safety Gate":`${rule.conditions.length} เงื่อนไข · ${rule.logic==="all"?"ต้องผ่านทั้งหมด":"ผ่านข้อใดข้อหนึ่ง"}`}</small></summary><div className="order-rule-body"><div className="field-grid"><label className="builder-field"><span>การรวมเงื่อนไขเสริม</span><span className="input-wrap"><select value={rule.logic} onChange={e=>updateOrderRule(orderIndex,{logic:e.target.value as "all"|"any"})}><option value="all">ALL · ต้องผ่านทุกข้อ</option><option value="any">ANY · ผ่านข้อใดก็ได้</option></select></span></label><div className="order-rule-required"><strong>เงื่อนไขบังคับ</strong><small>ระยะสวนทาง + Safety Gate</small></div></div>
                    {rule.conditions.map((condition,conditionIndex)=><div className="recovery-condition" key={`${orderIndex}-${conditionIndex}`}><div className="condition-row-heading"><strong>Condition {conditionIndex+1}</strong><button type="button" className="remove-condition" onClick={()=>removeOrderCondition(orderIndex,conditionIndex)}>ลบ</button></div><div className="field-grid"><label className="builder-field"><span>เงื่อนไข</span><span className="input-wrap"><select value={condition.kind} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,newCondition(e.target.value as RecoveryConditionKind))}>{Object.entries(conditionLabels).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></span></label>
                      {(condition.kind==="candle_reversal"||condition.kind==="trend_filter"||condition.kind==="range_reentry")&&<label className="builder-field"><span>Timeframe</span><span className="input-wrap"><select value={condition.timeframe??"same"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,timeframe:e.target.value})}><option value="same">ใช้ timeframe ของ Strategy</option><option value="M15">M15</option><option value="H1">H1</option><option value="H4">H4</option></select></span></label>}
                      {condition.kind==="trend_filter"&&<label className="builder-field"><span>วิธีกรอง Trend</span><span className="input-wrap"><select value={condition.method??"ema_slope"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,method:e.target.value})}><option value="ema_slope">ความชัน EMA</option><option value="ma_alignment">เส้นค่าเฉลี่ยเรียงตัว</option></select></span></label>}
                      {condition.kind==="range_reentry"&&<label className="builder-field"><span>รูปแบบสัญญาณ</span><span className="input-wrap"><select value={condition.method??"band_reentry"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,method:e.target.value})}><option value="band_reentry">ราคาปิดกลับเข้าช่อง</option><option value="boundary_rejection">ปฏิเสธบริเวณขอบกรอบ</option></select></span></label>}
                      {(condition.kind==="atr_gate"||condition.kind==="rsi_recovery")&&<>{field(condition.kind==="atr_gate"?"ATR period":"RSI period",condition.period??14,n=>updateOrderCondition(orderIndex,conditionIndex,{...condition,period:n}),"แท่ง",1)}{field(condition.kind==="atr_gate"?"ATR ratio threshold":"ระดับ RSI",condition.level??1,n=>updateOrderCondition(orderIndex,conditionIndex,{...condition,level:n}),condition.kind==="atr_gate"?"ratio":"ระดับ",0,0.1)}</>}
                      {condition.kind==="candle_reversal"&&<label className="builder-field"><span>การยืนยัน</span><span className="input-wrap"><select value={condition.method??"close_reversal"} onChange={e=>updateOrderCondition(orderIndex,conditionIndex,{...condition,method:e.target.value})}><option value="close_reversal">รอแท่งปิดกลับทิศ</option><option value="rejection">แท่งปฏิเสธราคา</option></select></span></label>}
                    </div></div>)}
                    <button type="button" className="add-condition-button" onClick={()=>addOrderCondition(orderIndex)}>＋ เพิ่ม Condition ให้ไม้แก้ {orderIndex+1}</button>
                  </div></details>})}</div>
                </div>; })()}
              </>}
            </div><div className="builder-callout">ค่าที่แสดงเป็นจุดเริ่มต้นสำหรับปรับแต่งและทดสอบ · การเพิ่มไม้ขณะขาดทุนเพิ่ม exposure · EA ที่เชื่อมอยู่ยังเป็น Probe อ่านอย่างเดียว ไม่มีคำสั่งซื้อขายหรือ Backtest</div>
          </>}
          {step === 2 && usesBasketExit(strategy) && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>เลือกวิธีปิดหรือคลายชุด</h2><p>ตั้งขีดจำกัด Basket TP/SL แล้วเพิ่มวิธีจัดการอื่นได้หลายข้อ · เงื่อนไขปิดเต็มชุดที่เกิดก่อนจะเป็นตัวปิดชุด</p></div><div className="settings-box"><div className="settings-title">ขีดจำกัดหลักของทั้งชุด <span>ใช้กับไม้แก้ทุกลำดับ</span></div><div className="field-grid">{field("ปิดทั้งชุดเมื่อกำไรถึง",strategy.exit.basketTakeProfit ?? 0,n=>setStrategy(s=>({...s,exit:{...s.exit,basketTakeProfit:n}})),"เงิน",0,0.01)}{field("ปิดทั้งชุดเมื่อขาดทุนถึง",strategy.exit.basketStopLoss ?? 0,n=>setStrategy(s=>({...s,exit:{...s.exit,basketStopLoss:n}})),"เงิน",0,0.01)}</div><p className="signal-explanation">Basket Stop Loss เป็นขอบเขตขาดทุนรวม ไม่ใช่ SL แยกรายออเดอร์ · กำหนด Basket TP/SL มากกว่า 0 ก่อนแชร์</p></div>
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
          {step === 2 && !usesBasketExit(strategy) && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>ตั้ง TP และ SL ของไม้เดียว</h2><p>Simple เปิดออเดอร์ครั้งเดียวตาม Entry แล้วปิดเมื่อถึง Take Profit หรือ Stop Loss</p></div><div className="settings-box"><div className="field-grid">{field("Stop Loss",strategy.exit.stopLossPips,n=>setStrategy(s=>({...s,exit:{...s.exit,stopLossPips:n}})),"pips")}{field("Take Profit",strategy.exit.takeProfitPips,n=>setStrategy(s=>({...s,exit:{...s.exit,takeProfitPips:n}})),"pips")}</div><p className="signal-explanation">ค่า pip อาจต่างกันตามสัญลักษณ์และโบรกเกอร์ ควรตรวจสอบก่อนใช้งานจริง</p></div></>}
          {step === 3 && <><div className="panel-heading"><span className="panel-tag">STEP 04 · PROTECTION</span><h2>ตั้งขอบเขตก่อนเริ่ม</h2><p>จำกัด spread สูงสุดที่ยอมรับได้ก่อนเปิดไม้ใหม่</p></div><div className="settings-box"><div className="field-grid">{field("Spread สูงสุด",strategy.protection.maxSpreadPoints,n=>setStrategy(s=>({...s,protection:{...s.protection,maxSpreadPoints:n}})),"points")}</div><p className="signal-explanation">เมื่อ spread เกินค่านี้ กติกาที่ตั้งไว้จะไม่เปิดไม้ใหม่ · points เป็นหน่วยของโบรกเกอร์ ไม่ใช่ pips เสมอไป</p></div><div className="builder-callout">✳ Template นี้เก็บค่า config บนเว็บเท่านั้น ตอนนี้ EA ที่เชื่อมอยู่เป็น Connectivity Probe แบบอ่านอย่างเดียว ยังไม่ส่งคำสั่งซื้อขายหรือ Backtest</div></>}
          <div className="panel-actions"><button type="button" className="button-back" onClick={()=>{setStep(Math.max(0,step-1));setNotice("");}} disabled={step===0}>← ย้อนกลับ</button>{step < 3 ? <button type="button" className="button-next" onClick={()=>{setStep(step+1);setNotice("");}}>ขั้นตอนถัดไป <span>→</span></button> : <button type="button" className="button-next" onClick={save}>บันทึก Draft <span>✓</span></button>}</div>
          {notice && <p className="builder-notice" role="status">{notice}</p>}
        </section>
      </div><aside className="builder-sidebar"><div className="sidebar-top"><span>YOUR STRATEGY</span><span className="draft-badge">● DEMO DRAFT</span></div><label className="sidebar-name">ชื่อ Strategy<input value={strategy.name} maxLength={80} onChange={e=>setStrategy(s=>({...s,name:e.target.value}))} /></label><div className="sidebar-fields"><label>สัญลักษณ์<input value={strategy.symbol} maxLength={20} onChange={e=>setStrategy(s=>({...s,symbol:e.target.value.toUpperCase()}))} /></label><label>Timeframe<select value={strategy.timeframe} onChange={e=>setStrategy(s=>({...s,timeframe:e.target.value}))}><option>M1</option><option>M5</option><option>M15</option><option>H1</option><option>H4</option><option>D1</option></select></label></div><div className="summary-list"><div><span>01 <b>Entry</b></span><strong>{summary}</strong></div><div><span>02 <b>Manage</b></span><strong>{hasManageOptions(strategy) ? manageMode(strategy) === "single" ? `${strategy.manage.lotSize} lot · Simple · 1 ไม้` : `${strategy.manage.lotSize} lot · ${recoveryPreset(strategy)==="custom"?"ชุด Custom":recoveryPresets.find(p=>p.id===recoveryPreset(strategy))?.title??"Recovery"} · แก้ ${strategy.manage.recovery?.maxAdds ?? 0} ไม้` : `${strategy.manage.lotSize} lot · สูงสุด ${strategy.manage.maxPositions} ไม้`}</strong></div><div><span>03 <b>Exit</b></span><strong>{usesBasketExit(strategy) ? `Basket SL ${strategy.exit.basketStopLoss || "ยังไม่ตั้ง"} · TP ${strategy.exit.basketTakeProfit || "ยังไม่ตั้ง"} · ${strategy.exit.closeRules?.length??0} วิธีเสริม` : `SL ${strategy.exit.stopLossPips} / TP ${strategy.exit.takeProfitPips} pips`}</strong></div><div><span>04 <b>Protection</b></span><strong>Spread ไม่เกิน {strategy.protection.maxSpreadPoints} points</strong></div></div><label className="publish-toggle"><input type="checkbox" checked={isPublic} onChange={e=>{if(e.target.checked){const error=valid(strategy);if(error){setNotice(error);return;}}setIsPublic(e.target.checked);}} /><span><strong>แชร์ใน Explore</strong><small>{valid(strategy) ? "กรอกเงื่อนไข Manage และ TP/SL ให้ครบก่อนแชร์" : "ทุกคนจะเห็นกติกานี้และคัดลอกได้ · ผล Backtest ยังไม่ผ่านการยืนยัน"}</small></span></label><button type="button" className="account-save" disabled={remoteBusy} onClick={saveRemote}>{remoteBusy ? "กำลังบันทึก…" : strategyId ? "บันทึกการแก้ไขในบัญชี" : "บันทึก Draft ลงบัญชี"}</button><div className="sidebar-account-links"><Link href="/account">เข้าสู่ระบบ</Link><Link href="/strategies">My Strategies →</Link><Link href="/explore">Explore →</Link></div><div className="sidebar-foot"><span>✳</span><p>บันทึกเป็น Draft ได้โดยยังไม่กรอก TP/SL ครบ แต่การแชร์หรือส่งไป Backtest ยังทำไม่ได้ · EA ที่เชื่อมอยู่เป็น Probe อ่านอย่างเดียว{loaded ? " · โหลด Draft กลับมาแก้ไขได้" : ""}</p></div></aside></div>
      <p className="builder-footer">EASpaze · สร้างอย่างเข้าใจ ทดลองอย่างรอบคอบ</p>
    </main>
  </div>;
}
