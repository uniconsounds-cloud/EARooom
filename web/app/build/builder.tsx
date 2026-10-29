"use client";

import Link from "next/link";
import { useState } from "react";

const STEPS = ["Entry", "Manage", "Exit", "Protection"] as const;
type Entry = "ma_cross" | "price_ma" | "rsi_recovery";
type Direction = "both" | "buy" | "sell";
type Strategy = {
  schemaVersion: 1; name: string; symbol: string; timeframe: string; direction: Direction;
  entry: { type: Entry; fastPeriod: number; slowPeriod: number; maPeriod: number; rsiPeriod: number; rsiLow: number; rsiHigh: number };
  manage: { lotSize: number; maxPositions: number };
  exit: { stopLossPips: number; takeProfitPips: number };
  protection: { maxSpreadPoints: number };
};
const defaults: Strategy = { schemaVersion: 1, name: "My first strategy", symbol: "EURUSD", timeframe: "H1", direction: "both", entry: { type: "ma_cross", fastPeriod: 20, slowPeriod: 50, maPeriod: 50, rsiPeriod: 14, rsiLow: 30, rsiHigh: 70 }, manage: { lotSize: 0.01, maxPositions: 1 }, exit: { stopLossPips: 30, takeProfitPips: 60 }, protection: { maxSpreadPoints: 30 } };
const choices: { id: Entry; title: string; label: string; description: string }[] = [
  { id: "ma_cross", title: "เส้นค่าเฉลี่ยตัดกัน", label: "MOVING AVERAGE CROSS", description: "ดูจังหวะที่เส้นเร็วตัดเส้นช้า เพื่อจับการเปลี่ยนทิศทาง" },
  { id: "price_ma", title: "ราคาตัดเส้นค่าเฉลี่ย", label: "PRICE CROSSES MA", description: "รอให้ราคาปิดข้ามเส้นค่าเฉลี่ย เพื่อดูการเปลี่ยนฝั่งของราคา" },
  { id: "rsi_recovery", title: "RSI กลับผ่านระดับ", label: "RSI RECOVERY", description: "รอ RSI กลับผ่านระดับที่ตั้งไว้ หลังอยู่ในเขตต่ำหรือสูง" },
];
const storageKey = "easpaze.strategy.draft.v1";
function num(value: string) { return value === "" ? 0 : Number(value); }
function valid(s: Strategy): string | null {
  if (!s.name.trim() || !s.symbol.trim()) return "กรุณาใส่ชื่อ Strategy และสัญลักษณ์ที่ต้องการเทรด";
  if (![s.entry.fastPeriod,s.entry.slowPeriod,s.entry.maPeriod,s.entry.rsiPeriod,s.manage.maxPositions].every(n => Number.isInteger(n) && n >= 1)) return "จำนวนช่วงและจำนวนไม้ต้องเป็นจำนวนเต็มอย่างน้อย 1";
  if (s.entry.type === "ma_cross" && s.entry.fastPeriod >= s.entry.slowPeriod) return "จำนวนช่วงของเส้นเร็วต้องน้อยกว่าเส้นช้า";
  if (!(s.entry.rsiLow > 0 && s.entry.rsiLow < s.entry.rsiHigh && s.entry.rsiHigh < 100)) return "ระดับ RSI ต้องมากกว่า 0 และน้อยกว่า 100 โดยระดับต่ำต้องน้อยกว่าระดับสูง";
  if (![s.manage.lotSize,s.exit.stopLossPips,s.exit.takeProfitPips,s.protection.maxSpreadPoints].every(n => Number.isFinite(n) && n > 0)) return "Lot, Stop Loss, Take Profit และ spread สูงสุดต้องมากกว่า 0";
  return null;
}
function isDraft(value: unknown): value is Strategy {
  if (!value || typeof value !== "object") return false;
  const s = value as Strategy;
  return s.schemaVersion === 1 && typeof s.name === "string" && typeof s.symbol === "string" && ["M15","H1","H4","D1"].includes(s.timeframe) && ["both","buy","sell"].includes(s.direction) && !!s.entry && ["ma_cross","price_ma","rsi_recovery"].includes(s.entry.type) && !!s.manage && !!s.exit && !!s.protection && !valid(s);
}

export default function Builder() {
  const [step, setStep] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>(defaults);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const updateEntry = (key: keyof Strategy["entry"], value: string | number) => setStrategy(s => ({ ...s, entry: { ...s.entry, [key]: value } }));
  const summary = strategy.entry.type === "ma_cross" ? `SMA ${strategy.entry.fastPeriod} ตัด SMA ${strategy.entry.slowPeriod}` : strategy.entry.type === "price_ma" ? `ราคาปิดตัด SMA ${strategy.entry.maPeriod}` : `RSI ${strategy.entry.rsiPeriod} กลับผ่าน ${strategy.entry.rsiLow} / ${strategy.entry.rsiHigh}`;
  function save() {
    const error = valid(strategy); if (error) { setNotice(error); return; }
    try { localStorage.setItem(storageKey, JSON.stringify(strategy)); setNotice("บันทึก draft ในเบราว์เซอร์นี้แล้ว"); setLoaded(true); } catch { setNotice("บันทึกไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์"); }
  }
  function load() {
    try { const raw = localStorage.getItem(storageKey); if (!raw) { setNotice("ยังไม่มี draft ที่บันทึกในเบราว์เซอร์นี้"); return; } const data: unknown = JSON.parse(raw); if (!isDraft(data)) { setNotice("ไม่สามารถอ่าน draft นี้ได้ กรุณาสร้าง draft ใหม่"); return; } setStrategy(data); setNotice("โหลด draft ที่บันทึกไว้แล้ว"); setLoaded(true); } catch { setNotice("ไม่สามารถอ่าน draft จากเบราว์เซอร์นี้ได้"); }
  }
  const field = (label: string, value: number, onChange: (n: number) => void, suffix: string, min = 1, increment = 1) => <label className="builder-field"><span>{label}</span><span className="input-wrap"><input type="number" min={min} step={increment} value={value || ""} onChange={e => onChange(num(e.target.value))} /><small>{suffix}</small></span></label>;
  return <div className="builder-page">
    <header className="builder-header"><Link href="/" className="builder-logo"><span>✳</span> EASpaze<span className="logo-period">.</span></Link><span className="header-divider" /><span className="header-title">Strategy Builder <small> / Draft</small></span><Link href="/" className="back-home">← กลับหน้าแรก</Link></header>
    <main className="builder-shell">
      <div className="builder-intro"><div><span className="builder-kicker">YOUR IDEAS START HERE</span><h1>มาสร้าง Strategy ของคุณกัน</h1><p>ค่อย ๆ ตั้งกติกาทีละขั้น เริ่มจากจังหวะเข้าเทรดที่คุณเข้าใจ</p></div><button type="button" onClick={load} className="builder-text-button">↻ โหลด draft ที่บันทึก</button></div>
      <div className="builder-layout"><div className="builder-main">
        <nav className="builder-steps" aria-label="ขั้นตอนการสร้างกลยุทธ์">{STEPS.map((name, i) => <button type="button" key={name} onClick={() => { setStep(i); setNotice(""); }} aria-current={i === step ? "step" : undefined} className={i === step ? "active" : ""}><span>{i + 1}</span><div><small>STEP 0{i + 1}</small><strong>{name}</strong></div></button>)}</nav>
        <section className="builder-panel">
          {step === 0 && <><div className="panel-heading"><span className="panel-tag">STEP 01 · ENTRY</span><h2>เริ่มเข้าเทรดเมื่อไหร่?</h2><p>เลือกหนึ่งวิธี แล้วกำหนดค่าที่คุณต้องการ สัญญาณใช้ข้อมูลจากแท่งที่ปิดแล้ว</p></div>
            <div className="entry-options">{choices.map(c => <button key={c.id} type="button" aria-pressed={strategy.entry.type === c.id} className={`entry-option ${strategy.entry.type === c.id ? "selected" : ""}`} onClick={() => updateEntry("type", c.id)}><span className="option-radio" /><span><small>{c.label}</small><strong>{c.title}</strong><em>{c.description}</em></span></button>)}</div>
            <div className="settings-box"><div className="settings-title">ตั้งค่าเงื่อนไข <span>ปรับได้ตามไอเดียของคุณ</span></div>
              {strategy.entry.type === "ma_cross" && <><div className="field-grid">{field("เส้นเร็ว (SMA)",strategy.entry.fastPeriod,n=>updateEntry("fastPeriod",n),"แท่ง")}{field("เส้นช้า (SMA)",strategy.entry.slowPeriod,n=>updateEntry("slowPeriod",n),"แท่ง")}</div><p className="signal-explanation">Buy เมื่อเส้นเร็วตัดขึ้นเหนือเส้นช้า · Sell เมื่อเส้นเร็วตัดลงต่ำกว่าเส้นช้า</p></>}
              {strategy.entry.type === "price_ma" && <><div className="field-grid">{field("เส้นค่าเฉลี่ย (SMA)",strategy.entry.maPeriod,n=>updateEntry("maPeriod",n),"แท่ง")}</div><p className="signal-explanation">Buy เมื่อราคาปิดตัดขึ้นเหนือ SMA · Sell เมื่อราคาปิดตัดลงต่ำกว่า SMA</p></>}
              {strategy.entry.type === "rsi_recovery" && <><div className="field-grid">{field("ช่วง RSI",strategy.entry.rsiPeriod,n=>updateEntry("rsiPeriod",n),"แท่ง")}{field("ระดับต่ำ",strategy.entry.rsiLow,n=>updateEntry("rsiLow",n),"RSI")}{field("ระดับสูง",strategy.entry.rsiHigh,n=>updateEntry("rsiHigh",n),"RSI")}</div><p className="signal-explanation">Buy เมื่อ RSI ตัดขึ้นผ่านระดับต่ำ · Sell เมื่อ RSI ตัดลงผ่านระดับสูง</p></>}
            </div><div className="direction-group"><span>ทิศทางที่ต้องการเทรด</span><div>{([ ["both","Buy + Sell"],["buy","Buy เท่านั้น"],["sell","Sell เท่านั้น"] ] as const).map(([value,label])=><button key={value} type="button" className={strategy.direction === value ? "selected" : ""} aria-pressed={strategy.direction === value} onClick={()=>setStrategy(s=>({...s,direction:value}))}>{label}</button>)}</div></div></>}
          {step === 1 && <><div className="panel-heading"><span className="panel-tag">STEP 02 · MANAGE</span><h2>ดูแลไม้ของคุณ</h2><p>กำหนดขนาดไม้คงที่และจำนวนไม้สูงสุดที่เปิดพร้อมกัน</p></div><div className="settings-box"><div className="field-grid">{field("ขนาดไม้คงที่",strategy.manage.lotSize,n=>setStrategy(s=>({...s,manage:{...s.manage,lotSize:n}})),"lot",0.01,0.01)}{field("จำนวนไม้สูงสุด",strategy.manage.maxPositions,n=>setStrategy(s=>({...s,manage:{...s.manage,maxPositions:n}})),"ไม้")}</div><p className="signal-explanation">ขนาด lot ที่ใช้ได้จริงขึ้นอยู่กับข้อกำหนดของโบรกเกอร์และสินทรัพย์</p></div></>}
          {step === 2 && <><div className="panel-heading"><span className="panel-tag">STEP 03 · EXIT</span><h2>วางแผนจบแต่ละไม้</h2><p>กำหนดระยะตัดขาดทุนและเป้าหมายกำไรสำหรับแต่ละออเดอร์</p></div><div className="settings-box"><div className="field-grid">{field("Stop Loss",strategy.exit.stopLossPips,n=>setStrategy(s=>({...s,exit:{...s.exit,stopLossPips:n}})),"pips")}{field("Take Profit",strategy.exit.takeProfitPips,n=>setStrategy(s=>({...s,exit:{...s.exit,takeProfitPips:n}})),"pips")}</div><p className="signal-explanation">ค่า pip อาจต่างกันตามสัญลักษณ์และโบรกเกอร์ ควรตรวจสอบก่อนใช้งานจริง</p></div></>}
          {step === 3 && <><div className="panel-heading"><span className="panel-tag">STEP 04 · PROTECTION</span><h2>ตั้งขอบเขตก่อนเริ่ม</h2><p>จำกัด spread สูงสุดที่ยอมรับได้ก่อนเปิดไม้ใหม่</p></div><div className="settings-box"><div className="field-grid">{field("Spread สูงสุด",strategy.protection.maxSpreadPoints,n=>setStrategy(s=>({...s,protection:{...s.protection,maxSpreadPoints:n}})),"points")}</div><p className="signal-explanation">เมื่อ spread เกินค่านี้ กติกาที่ตั้งไว้จะไม่เปิดไม้ใหม่ · points เป็นหน่วยของโบรกเกอร์ ไม่ใช่ pips เสมอไป</p></div><div className="builder-callout">✳ ตัวเลขเริ่มต้นเป็นเพียงตัวอย่างเพื่อช่วยตั้งค่า ไม่ใช่คำแนะนำหรือการรับประกันผลการเทรด</div></>}
          <div className="panel-actions"><button type="button" className="button-back" onClick={()=>{setStep(Math.max(0,step-1));setNotice("");}} disabled={step===0}>← ย้อนกลับ</button>{step < 3 ? <button type="button" className="button-next" onClick={()=>{setStep(step+1);setNotice("");}}>ขั้นตอนถัดไป <span>→</span></button> : <button type="button" className="button-next" onClick={save}>บันทึก Draft <span>✓</span></button>}</div>
          {notice && <p className="builder-notice" role="status">{notice}</p>}
        </section>
      </div><aside className="builder-sidebar"><div className="sidebar-top"><span>YOUR STRATEGY</span><span className="draft-badge">● DRAFT</span></div><label className="sidebar-name">ชื่อ Strategy<input value={strategy.name} maxLength={80} onChange={e=>setStrategy(s=>({...s,name:e.target.value}))} /></label><div className="sidebar-fields"><label>สัญลักษณ์<input value={strategy.symbol} maxLength={20} onChange={e=>setStrategy(s=>({...s,symbol:e.target.value.toUpperCase()}))} /></label><label>Timeframe<select value={strategy.timeframe} onChange={e=>setStrategy(s=>({...s,timeframe:e.target.value}))}><option>M15</option><option>H1</option><option>H4</option><option>D1</option></select></label></div><div className="summary-list"><div><span>01 <b>Entry</b></span><strong>{summary}</strong></div><div><span>02 <b>Manage</b></span><strong>{strategy.manage.lotSize} lot · สูงสุด {strategy.manage.maxPositions} ไม้</strong></div><div><span>03 <b>Exit</b></span><strong>SL {strategy.exit.stopLossPips} / TP {strategy.exit.takeProfitPips} pips</strong></div><div><span>04 <b>Protection</b></span><strong>Spread ไม่เกิน {strategy.protection.maxSpreadPoints} points</strong></div></div><div className="sidebar-foot"><span>✳</span><p>Draft เก็บเฉพาะในเบราว์เซอร์นี้ ยังไม่ได้เชื่อมบัญชี, Backtest หรือ MT5{loaded ? " คุณสามารถโหลดกลับมาแก้ไขได้" : ""}</p></div></aside></div>
      <p className="builder-footer">EASpaze · สร้างอย่างเข้าใจ ทดลองอย่างรอบคอบ</p>
    </main>
  </div>;
}
