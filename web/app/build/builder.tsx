"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const STEPS = ["Entry", "Manage", "Exit", "Protection"] as const;
type Entry = "ma_cross" | "price_ma" | "rsi_recovery";
type Direction = "both" | "buy" | "sell";
type LotMode = "fixed" | "multiplier";
type Strategy = {
  schemaVersion: 1; strategyType?: "gold_scalping_recovery"; name: string; symbol: string; timeframe: string; direction: Direction;
  entry: { type: Entry; fastPeriod: number; slowPeriod: number; maPeriod: number; rsiPeriod: number; rsiLow: number; rsiHigh: number };
  manage: { lotSize: number; maxPositions: number; mode?: "single" | "recovery"; recovery?: { maxAdds: number; spacingPoints: number; lotMode: LotMode; lotMultiplier: number } };
  exit: { stopLossPips: number; takeProfitPips: number; basketStopLoss?: number; basketTakeProfit?: number };
  protection: { maxSpreadPoints: number };
};
const defaults: Strategy = { schemaVersion: 1, strategyType: "gold_scalping_recovery", name: "Gold Scalping Recovery · Demo", symbol: "XAUUSD.v", timeframe: "M5", direction: "both", entry: { type: "ma_cross", fastPeriod: 20, slowPeriod: 50, maPeriod: 50, rsiPeriod: 14, rsiLow: 30, rsiHigh: 70 }, manage: { lotSize: 0.01, maxPositions: 4, mode: "recovery", recovery: { maxAdds: 3, spacingPoints: 0, lotMode: "fixed", lotMultiplier: 1 } }, exit: { stopLossPips: 30, takeProfitPips: 60, basketStopLoss: 0, basketTakeProfit: 0 }, protection: { maxSpreadPoints: 30 } };
const choices: { id: Entry; title: string; label: string; description: string }[] = [
  { id: "ma_cross", title: "เส้นค่าเฉลี่ยตัดกัน", label: "MOVING AVERAGE CROSS", description: "ดูจังหวะที่เส้นเร็วตัดเส้นช้า เพื่อจับการเปลี่ยนทิศทาง" },
  { id: "price_ma", title: "ราคาตัดเส้นค่าเฉลี่ย", label: "PRICE CROSSES MA", description: "รอให้ราคาปิดข้ามเส้นค่าเฉลี่ย เพื่อดูการเปลี่ยนฝั่งของราคา" },
  { id: "rsi_recovery", title: "RSI กลับผ่านระดับ", label: "RSI RECOVERY", description: "รอ RSI กลับผ่านระดับที่ตั้งไว้ หลังอยู่ในเขตต่ำหรือสูง" },
];
const storageKey = "easpaze.strategy.draft.v1";
function num(value: string) { return value === "" ? 0 : Number(value); }
function manageMode(s: Strategy): "single" | "recovery" {
  return s.manage.mode ?? (s.manage.recovery?.maxAdds ? "recovery" : "single");
}
function validDraft(s: Strategy): string | null {
  if (!s.name.trim() || !s.symbol.trim()) return "กรุณาใส่ชื่อ Strategy และสัญลักษณ์ที่ต้องการเทรด";
  if (![s.entry.fastPeriod,s.entry.slowPeriod,s.entry.maPeriod,s.entry.rsiPeriod,s.manage.maxPositions].every(n => Number.isInteger(n) && n >= 1)) return "จำนวนช่วงและจำนวนไม้ต้องเป็นจำนวนเต็มอย่างน้อย 1";
  if (s.entry.type === "ma_cross" && s.entry.fastPeriod >= s.entry.slowPeriod) return "จำนวนช่วงของเส้นเร็วต้องน้อยกว่าเส้นช้า";
  if (!(s.entry.rsiLow > 0 && s.entry.rsiLow < s.entry.rsiHigh && s.entry.rsiHigh < 100)) return "ระดับ RSI ต้องมากกว่า 0 และน้อยกว่า 100 โดยระดับต่ำต้องน้อยกว่าระดับสูง";
  if (![s.manage.lotSize,s.protection.maxSpreadPoints].every(n => Number.isFinite(n) && n > 0)) return "Lot เริ่มต้นและ spread สูงสุดต้องมากกว่า 0";
  if (s.strategyType === "gold_scalping_recovery") {
    const recovery = s.manage.recovery;
    if (!recovery || !Number.isInteger(recovery.maxAdds) || recovery.maxAdds < 0 || recovery.maxAdds > 3) return "จำนวนไม้แก้ต้องอยู่ระหว่าง 0 ถึง 3 ไม้";
    if (s.manage.mode !== undefined && !["single","recovery"].includes(s.manage.mode)) return "เลือกรูปแบบการจัดการไม้ก่อนบันทึก";
    if (manageMode(s) === "single" && s.manage.maxPositions !== 1) return "โหมดไม้คงที่เปิดได้ครั้งละ 1 ไม้";
    if (manageMode(s) === "recovery" && s.manage.maxPositions !== recovery.maxAdds + 1) return "จำนวนไม้รวมต้องเท่ากับไม้แรกบวกจำนวนไม้แก้";
    if (!Number.isFinite(recovery.spacingPoints) || recovery.spacingPoints < 0) return "ระยะเพิ่มไม้ต้องเป็น 0 หรือจำนวน points ที่มากกว่า 0";
    if (recovery.lotMode === "multiplier" && (!Number.isFinite(recovery.lotMultiplier) || recovery.lotMultiplier < 1)) return "ตัวคูณ lot ต้องไม่น้อยกว่า 1";
    if ([s.exit.basketStopLoss ?? 0,s.exit.basketTakeProfit ?? 0].some(n => !Number.isFinite(n) || n < 0)) return "ค่า Basket TP/SL ต้องเป็น 0 หรือจำนวนเงินที่มากกว่า 0";
  } else if (![s.exit.stopLossPips,s.exit.takeProfitPips].every(n => Number.isFinite(n) && n > 0)) return "Stop Loss และ Take Profit ต้องมากกว่า 0";
  return null;
}
function valid(s: Strategy): string | null {
  const draftError = validDraft(s);
  if (draftError) return draftError;
  if (s.strategyType === "gold_scalping_recovery") {
    if (manageMode(s) === "recovery" && s.manage.recovery?.maxAdds && s.manage.recovery.spacingPoints <= 0) return "กำหนดระยะสวนทางก่อนเพิ่มไม้เป็น points ก่อนแชร์ Strategy";
    if ((s.exit.basketStopLoss ?? 0) <= 0 || (s.exit.basketTakeProfit ?? 0) <= 0) return "กำหนด Basket Stop Loss และ Basket Take Profit ก่อนแชร์ Strategy";
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
  const [strategy, setStrategy] = useState<Strategy>(defaults);
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
      setStrategy(data.config);
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
  const summary = strategy.entry.type === "ma_cross" ? `SMA ${strategy.entry.fastPeriod} ตัด SMA ${strategy.entry.slowPeriod}` : strategy.entry.type === "price_ma" ? `ราคาปิดตัด SMA ${strategy.entry.maPeriod}` : `RSI ${strategy.entry.rsiPeriod} กลับผ่าน ${strategy.entry.rsiLow} / ${strategy.entry.rsiHigh}`;
  function save() {
    const error = validDraft(strategy); if (error) { setNotice(error); return; }
    try { localStorage.setItem(storageKey, JSON.stringify(strategy)); setNotice("บันทึก draft ในเบราว์เซอร์นี้แล้ว"); setLoaded(true); } catch { setNotice("บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์"); }
  }
  function load() {
    try { const raw = localStorage.getItem(storageKey); if (!raw) { setNotice("ยังไม่มี draft ที่บันทึกในเบราว์เซอร์นี้"); return; } const data: unknown = JSON.parse(raw); if (!isDraft(data)) { setNotice("ไม่สามารถอ่าน draft นี้ได้ กรุณาสร้าง draft ใหม่"); return; } setStrategy(data); setStrategyId(null); setIsPublic(false); window.history.replaceState(null, "", "/build"); setNotice("โหลด draft ในเบราว์เซอร์แล้ว · บันทึกลงบัญชีเป็น Strategy ใหม่ได้"); setLoaded(true); } catch { setNotice("ไม่สามารถอ่าน draft จากเบราว์เซอร์นี้ได้"); }
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
          {step === 1 && strategy.strategyType === "gold_scalping_recovery" && <>
            <div className="panel-heading"><span className="panel-tag">STEP 02 · MANAGE</span><h2>เลือกรูปแบบการออกไม้</h2><p>เลือกได้ว่าจะเปิดไม้เดียวตามสัญญาณ หรือเปิดไม้เพิ่มเมื่อราคาเคลื่อนสวนทาง</p></div>
            <div className="manage-mode-options" role="group" aria-label="รูปแบบการจัดการไม้">
              <button type="button" className={manageMode(strategy) === "single" ? "selected" : ""} aria-pressed={manageMode(strategy) === "single"} onClick={() => setStrategy(s => ({...s,manage:{...s.manage,mode:"single",maxPositions:1}}))}><span className="mode-indicator"/><span><strong>ไม้คงที่ · 1 ไม้</strong><small>เปิดไม้แรกตามสัญญาณ ไม่มีการเพิ่มไม้แก้</small></span></button>
              <button type="button" className={manageMode(strategy) === "recovery" ? "selected" : ""} aria-pressed={manageMode(strategy) === "recovery"} onClick={() => setStrategy(s => {const saved=s.manage.recovery ?? {maxAdds:3,spacingPoints:0,lotMode:"fixed" as LotMode,lotMultiplier:1};const recovery=saved.maxAdds>0?saved:{...saved,maxAdds:3};return {...s,manage:{...s.manage,mode:"recovery",maxPositions:recovery.maxAdds+1,recovery}};})}><span className="mode-indicator"/><span><strong>มีการแก้ไม้</strong><small>ตั้งจำนวนไม้ ระยะเพิ่ม และรูปแบบ lot เพิ่มเติม</small></span></button>
            </div>
            <div className="settings-box"><div className="settings-title">ค่าที่ใช้ร่วมกัน <span>ใช้ทั้งสองรูปแบบ</span></div><div className="field-grid">{field("Lot เริ่มต้น",strategy.manage.lotSize,n=>setStrategy(s=>({...s,manage:{...s.manage,lotSize:n}})),"lot",0.01,0.01)}</div><p className="signal-explanation">Lot เริ่มต้นใช้กับไม้แรก · ขนาด lot ที่ใช้ได้จริงขึ้นอยู่กับข้อกำหนดของโบรกเกอร์และสินทรัพย์</p>
              {manageMode(strategy) === "single" ? <div className="mode-detail-note">โหมดนี้เปิดได้ครั้งละ 1 ไม้ และไม่เพิ่มออเดอร์เมื่อราคาเคลื่อนสวนทาง</div> : <><div className="field-grid recovery-fields"><label className="builder-field"><span>จำนวนไม้แก้</span><span className="input-wrap"><select value={strategy.manage.recovery?.maxAdds ?? 3} onChange={e=>setStrategy(s=>{const maxAdds=num(e.target.value);return {...s,manage:{...s.manage,maxPositions:maxAdds+1,recovery:{...(s.manage.recovery ?? {spacingPoints:0,lotMode:"fixed" as LotMode,lotMultiplier:1}),maxAdds}}};})}><option value={1}>1 ไม้เพิ่ม</option><option value={2}>2 ไม้เพิ่ม</option><option value={3}>3 ไม้เพิ่ม</option></select></span></label>{field("ระยะสวนทางก่อนเพิ่มไม้",strategy.manage.recovery?.spacingPoints ?? 0,n=>setStrategy(s=>({...s,manage:{...s.manage,recovery:{...(s.manage.recovery ?? {maxAdds:3,lotMode:"fixed",lotMultiplier:1}),spacingPoints:n}}})),"points",0,1)}</div><p className="signal-explanation">เพิ่มไม้เมื่อราคาเคลื่อนสวนทางจากไม้ล่าสุดครบระยะนี้ · Points อาจต่างกันตาม broker · ต้องตั้งระยะมากกว่า 0 ก่อนแชร์</p><details className="advanced-settings"><summary>ตั้งค่าขั้นสูง · รูปแบบ lot ของไม้แก้</summary><div className="field-grid"><label className="builder-field"><span>ขนาด lot ของไม้แก้</span><span className="input-wrap"><select value={strategy.manage.recovery?.lotMode ?? "fixed"} onChange={e=>setStrategy(s=>({...s,manage:{...s.manage,recovery:{...(s.manage.recovery ?? {maxAdds:3,spacingPoints:0,lotMultiplier:1}),lotMode:e.target.value as LotMode}}}))}><option value="fixed">เท่ากับ Lot เริ่มต้น</option><option value="multiplier">คูณจากไม้ก่อนหน้า</option></select></span></label>{strategy.manage.recovery?.lotMode === "multiplier" && field("ตัวคูณ Lot",strategy.manage.recovery.lotMultiplier,n=>setStrategy(s=>({...s,manage:{...s.manage,recovery:{...(s.manage.recovery ?? {maxAdds:3,spacingPoints:0,lotMode:"multiplier" as LotMode}),lotMultiplier:n}}})),"×",1,0.1)}</div></details></>}
            </div><div className="builder-callout">ค่าเริ่มต้นเป็นตัวอย่างแก้ไขได้ · การเพิ่มไม้ขณะขาดทุนเพิ่ม exposure · Draft นี้ยังไม่ส่งคำสั่งหรือ Backtest</div>
          </>}
          {step === 1 && strategy.strategyType !== "gold_scalping_recovery" && <><div className="panel-heading"><span className="panel-tag">STEP 02 · MANAGE</span><h2>ดูแลไม้ของคุณ</h2><p>กำหนดขนาดไม้คงที่และจำนวนไม้สูงสุดที่เปิดพร้อมกัน</p></div><div className="settings-box"><div className="field-grid">{field("ขนาดไม้คงที่",strategy.manage.lotSize,n=>setStrategy(s=>({...s,manage:{...s.manage,lotSize:n}})),"lot",0.01,0.01)}{field("จำนวนไม้สูงสุด",strategy.manage.maxPositions,n=>setStrategy(s=>({...s,manage:{...s.manage,maxPositions:n}})),"ไม้")}</div><p className="signal-explanation">ขนาด lot ที่ใช้ได้จริงขึ้นอยู่กับข้อกำหนดของโบรกเกอร์และสินทรัพย์</p></div></>}
          {step === 2 && strategy.strategyType === "gold_scalping_recovery" && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>ปิดทั้งชุดเมื่อถึงเป้า</h2><p>กำหนดกำไรเป้าหมายและขาดทุนสูงสุดรวมของทุกไม้ · ใช้สกุลเงินเดียวกับบัญชี MT5</p></div><div className="settings-box"><div className="field-grid">{field("ปิดทั้งชุดเมื่อกำไรถึง",strategy.exit.basketTakeProfit ?? 0,n=>setStrategy(s=>({...s,exit:{...s.exit,basketTakeProfit:n}})),"เงิน",0,0.01)}{field("ปิดทั้งชุดเมื่อขาดทุนถึง",strategy.exit.basketStopLoss ?? 0,n=>setStrategy(s=>({...s,exit:{...s.exit,basketStopLoss:n}})),"เงิน",0,0.01)}</div><p className="signal-explanation">กำหนดทั้งสองค่าเป็นจำนวนเงินมากกว่า 0 ก่อนแชร์ได้ · Stop Loss จะเป็นขอบเขตขาดทุนรวมของชุด ไม่ใช่ SL แยกรายออเดอร์</p></div></>}
          {step === 2 && strategy.strategyType !== "gold_scalping_recovery" && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>วางแผนจบแต่ละไม้</h2><p>กำหนดระยะตัดขาดทุนและเป้าหมายกำไรสำหรับแต่ละออเดอร์</p></div><div className="settings-box"><div className="field-grid">{field("Stop Loss",strategy.exit.stopLossPips,n=>setStrategy(s=>({...s,exit:{...s.exit,stopLossPips:n}})),"pips")}{field("Take Profit",strategy.exit.takeProfitPips,n=>setStrategy(s=>({...s,exit:{...s.exit,takeProfitPips:n}})),"pips")}</div><p className="signal-explanation">ค่า pip อาจต่างกันตามสัญลักษณ์และโบรกเกอร์ ควรตรวจสอบก่อนใช้งานจริง</p></div></>}
          {step === 3 && <><div className="panel-heading"><span className="panel-tag">STEP 04 · PROTECTION</span><h2>ตั้งขอบเขตก่อนเริ่ม</h2><p>จำกัด spread สูงสุดที่ยอมรับได้ก่อนเปิดไม้ใหม่</p></div><div className="settings-box"><div className="field-grid">{field("Spread สูงสุด",strategy.protection.maxSpreadPoints,n=>setStrategy(s=>({...s,protection:{...s.protection,maxSpreadPoints:n}})),"points")}</div><p className="signal-explanation">เมื่อ spread เกินค่านี้ กติกาที่ตั้งไว้จะไม่เปิดไม้ใหม่ · points เป็นหน่วยของโบรกเกอร์ ไม่ใช่ pips เสมอไป</p></div><div className="builder-callout">✳ Template นี้เก็บค่า config บนเว็บเท่านั้น ตอนนี้ EA ที่เชื่อมอยู่เป็น Connectivity Probe แบบอ่านอย่างเดียว ยังไม่ส่งคำสั่งซื้อขายหรือ Backtest</div></>}
          <div className="panel-actions"><button type="button" className="button-back" onClick={()=>{setStep(Math.max(0,step-1));setNotice("");}} disabled={step===0}>← ย้อนกลับ</button>{step < 3 ? <button type="button" className="button-next" onClick={()=>{setStep(step+1);setNotice("");}}>ขั้นตอนถัดไป <span>→</span></button> : <button type="button" className="button-next" onClick={save}>บันทึก Draft <span>✓</span></button>}</div>
          {notice && <p className="builder-notice" role="status">{notice}</p>}
        </section>
      </div><aside className="builder-sidebar"><div className="sidebar-top"><span>YOUR STRATEGY</span><span className="draft-badge">● DEMO DRAFT</span></div><label className="sidebar-name">ชื่อ Strategy<input value={strategy.name} maxLength={80} onChange={e=>setStrategy(s=>({...s,name:e.target.value}))} /></label><div className="sidebar-fields"><label>สัญลักษณ์<input value={strategy.symbol} maxLength={20} onChange={e=>setStrategy(s=>({...s,symbol:e.target.value.toUpperCase()}))} /></label><label>Timeframe<select value={strategy.timeframe} onChange={e=>setStrategy(s=>({...s,timeframe:e.target.value}))}><option>M1</option><option>M5</option><option>M15</option><option>H1</option><option>H4</option><option>D1</option></select></label></div><div className="summary-list"><div><span>01 <b>Entry</b></span><strong>{summary}</strong></div><div><span>02 <b>Manage</b></span><strong>{strategy.strategyType === "gold_scalping_recovery" ? manageMode(strategy) === "single" ? `${strategy.manage.lotSize} lot · ไม้คงที่ 1 ไม้` : `${strategy.manage.lotSize} lot · แก้ ${strategy.manage.recovery?.maxAdds ?? 0} ไม้ · ทุก ${strategy.manage.recovery?.spacingPoints || "ยังไม่ตั้ง"} points` : `${strategy.manage.lotSize} lot · สูงสุด ${strategy.manage.maxPositions} ไม้`}</strong></div><div><span>03 <b>Exit</b></span><strong>{strategy.strategyType === "gold_scalping_recovery" ? `Basket SL ${strategy.exit.basketStopLoss || "ยังไม่ตั้ง"} · TP ${strategy.exit.basketTakeProfit || "ยังไม่ตั้ง"}` : `SL ${strategy.exit.stopLossPips} / TP ${strategy.exit.takeProfitPips} pips`}</strong></div><div><span>04 <b>Protection</b></span><strong>Spread ไม่เกิน {strategy.protection.maxSpreadPoints} points</strong></div></div><label className="publish-toggle"><input type="checkbox" checked={isPublic} onChange={e=>{if(e.target.checked){const error=valid(strategy);if(error){setNotice(error);return;}}setIsPublic(e.target.checked);}} /><span><strong>แชร์ใน Explore</strong><small>{valid(strategy) ? "กรอกระยะเพิ่มไม้และ Basket TP/SL ให้ครบก่อนแชร์" : "ทุกคนจะเห็นกติกานี้และคัดลอกได้ · ผล Backtest ยังไม่ผ่านการยืนยัน"}</small></span></label><button type="button" className="account-save" disabled={remoteBusy} onClick={saveRemote}>{remoteBusy ? "กำลังบันทึก…" : strategyId ? "บันทึกการแก้ไขในบัญชี" : "บันทึก Draft ลงบัญชี"}</button><div className="sidebar-account-links"><Link href="/account">เข้าสู่ระบบ</Link><Link href="/strategies">My Strategies →</Link><Link href="/explore">Explore →</Link></div><div className="sidebar-foot"><span>✳</span><p>บันทึกเป็น Draft ได้โดยยังไม่กรอก TP/SL ครบ แต่การแชร์หรือส่งไป Backtest ยังทำไม่ได้ · EA ที่เชื่อมอยู่เป็น Probe อ่านอย่างเดียว{loaded ? " · โหลด Draft กลับมาแก้ไขได้" : ""}</p></div></aside></div>
      <p className="builder-footer">EASpaze · สร้างอย่างเข้าใจ ทดลองอย่างรอบคอบ</p>
    </main>
  </div>;
}
