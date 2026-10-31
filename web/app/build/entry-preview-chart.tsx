"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EntryConditionGroup, EntryModule, EntryTrigger, Strategy } from "./builder";

type Bar = { open: number; high: number; low: number; close: number };
type Line = { module: EntryModule; values: (number | null)[]; secondValues?: (number | null)[] };
const W = 760;
const H = 352;
const LEFT = 42;
const RIGHT = 744;
const TOP = 24;
const PRICE_BOTTOM = 257;
const INDICATOR_TOP = 280;
const INDICATOR_BOTTOM = 326;
const COUNT = 64;
const POINT = 0.01;
const EMPTY_GROUP: EntryConditionGroup = { logic: "all", conditions: [] };

// Interpolate the same candles and indicator samples rather than remounting the SVG.
// A new edit interrupts from the currently displayed scene, so rapid edits stay smooth.
function useAnimatedScene(targetBars: Bar[], targetLines: Line[]) {
  const [scene, setScene] = useState({ bars: targetBars, lines: targetLines });
  const displayed = useRef(scene);
  useEffect(() => {
    const from = displayed.current;
    let frame = 0;
    let started: number | undefined;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380;
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const animate = (now: number) => {
      started ??= now;
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      const t = 1 - Math.pow(1 - progress, 3);
      const bars = targetBars.map((bar, i) => {
        const old = from.bars[i] ?? bar;
        return { open: mix(old.open, bar.open, t), close: mix(old.close, bar.close, t), high: mix(old.high, bar.high, t), low: mix(old.low, bar.low, t) };
      });
      const lines = targetLines.map((line, i) => {
        const old = from.lines[i]?.module.kind === line.module.kind ? from.lines[i] : undefined;
        const interpolate = (values: (number | null)[], previous?: (number | null)[]) => values.map((value, index) => value === null ? null : mix(previous?.[index] ?? value, value, t));
        return { ...line, values: interpolate(line.values, old?.values), secondValues: line.secondValues ? interpolate(line.secondValues, old?.secondValues) : undefined };
      });
      displayed.current = { bars, lines };
      setScene(displayed.current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetBars, targetLines]);
  return scene;
}

function makeBars(symbol: string, timeframe: string, count: number): Bar[] {
  const seedText = `${symbol}:${timeframe}`;
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const volatility: Record<string, number> = { M1: 0.48, M5: 0.82, M15: 1.18, H1: 1.85, H4: 2.7, D1: 4.2 };
  const scale = volatility[timeframe] ?? 0.82;
  let close = 2368;
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const trend = Math.sin(i / 18) * 0.34 + (i > count * 0.62 ? 0.035 : -0.012);
    const open = close;
    close = Math.max(1, open + trend * scale + (random() - 0.49) * scale * 2.3);
    const wick = random() * scale * 0.8 + scale * 0.18;
    bars.push({ open, close, high: Math.max(open, close) + wick * random(), low: Math.min(open, close) - wick * random() });
  }
  return bars;
}

function ema(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (Math.max(1, period) + 1);
  let current: number | null = null;
  values.forEach(value => { current = current === null ? value : value * multiplier + current * (1 - multiplier); result.push(current); });
  return result;
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => index + 1 < period ? null : values.slice(index + 1 - period, index + 1).reduce((sum, value) => sum + value, 0) / period);
}

function rsi(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => {
    if (index < period) return null;
    let gains = 0; let losses = 0;
    for (let i = index - period + 1; i <= index; i++) {
      const delta = values[i] - values[i - 1];
      if (delta > 0) gains += delta; else losses -= delta;
    }
    if (losses === 0) return 100;
    return 100 - 100 / (1 + gains / losses);
  });
}

function stochastic(bars: Bar[], module: EntryModule): { k: (number | null)[]; d: (number | null)[] } {
  const raw = bars.map((_, index) => {
    const lookback = Math.max(1, module.period ?? 15);
    if (index + 1 < lookback) return null;
    const window = bars.slice(index + 1 - lookback, index + 1);
    const low = Math.min(...window.map(bar => bar.low));
    const high = Math.max(...window.map(bar => bar.high));
    return high === low ? 50 : (bars[index].close - low) / (high - low) * 100;
  });
  const slow = raw.map((_, index) => {
    const length = Math.max(1, module.slowPeriod ?? 9);
    const window = raw.slice(Math.max(0, index + 1 - length), index + 1).filter((value): value is number => value !== null);
    return window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : null;
  });
  const d = slow.map((_, index) => {
    const length = Math.max(1, module.signalPeriod ?? 2);
    const window = slow.slice(Math.max(0, index + 1 - length), index + 1).filter((value): value is number => value !== null);
    return window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : null;
  });
  return { k: slow, d };
}

function linesFor(group: EntryConditionGroup, bars: Bar[]): Line[] {
  const closes = bars.map(bar => bar.close);
  return group.conditions.map(module => {
    if (module.kind === "ema") return { module, values: ema(closes, module.period ?? 400) };
    if (module.kind === "ma_cross") return { module, values: (module.averageType ?? "SMA") === "EMA" ? ema(closes, module.fastPeriod ?? 20) : sma(closes, module.fastPeriod ?? 20), secondValues: (module.averageType ?? "SMA") === "EMA" ? ema(closes, module.slowPeriod ?? 50) : sma(closes, module.slowPeriod ?? 50) };
    if (module.kind === "price_cross" && module.target !== "price_level") return { module, values: (module.averageType ?? "EMA") === "EMA" ? ema(closes, module.period ?? 50) : sma(closes, module.period ?? 50) };
    if (module.kind === "rsi") return { module, values: rsi(closes, module.period ?? 14) };
    if (module.kind === "stochastic") { const values = stochastic(bars, module); return { module, values: values.k, secondValues: values.d }; }
    return { module, values: [] };
  });
}

function compareCross(previousA: number | null | undefined, currentA: number | null | undefined, previousB: number | null | undefined, currentB: number | null | undefined, side: "buy" | "sell") {
  if (previousA == null || currentA == null || previousB == null || currentB == null) return false;
  return side === "buy" ? previousA <= previousB && currentA > currentB : previousA >= previousB && currentA < currentB;
}

function moduleMatches(module: EntryModule, line: Line, index: number, bars: Bar[], side: "buy" | "sell") {
  const value = line.values[index]; const previous = line.values[index - 1];
  const second = line.secondValues?.[index]; const previousSecond = line.secondValues?.[index - 1];
  if (module.kind === "ema") {
    if (value == null) return false;
    if (module.rule === "price_above") return bars[index].close > value;
    if (module.rule === "price_below") return bars[index].close < value;
    if (module.rule === "slope_with_direction") return previous != null && (side === "buy" ? value > previous : value < previous);
    return side === "buy" ? bars[index].close > value : bars[index].close < value;
  }
  if (module.kind === "ma_cross") {
    const up = module.rule === "cross_up" ? "buy" : module.rule === "cross_down" ? "sell" : side;
    return compareCross(previous, value, previousSecond, second, up);
  }
  if (module.kind === "price_cross") {
    const target = module.target === "price_level" ? module.level : value;
    const oldTarget = module.target === "price_level" ? module.level : previous;
    if (target == null || oldTarget == null) return false;
    const previousClose = bars[index - 1]?.close;
    const up = module.rule === "cross_up" ? true : module.rule === "cross_down" ? false : side === "buy";
    return up ? previousClose <= oldTarget && bars[index].close > target : previousClose >= oldTarget && bars[index].close < target;
  }
  if (module.kind === "stochastic") {
    if (value == null) return false;
    if (module.rule === "k_above_d") return second != null && value > second;
    if (module.rule === "k_below_d") return second != null && value < second;
    if (module.rule === "extreme_for_direction") return side === "buy" ? value <= (module.level ?? 20) : value >= (module.upperLevel ?? 80);
    return compareCross(previous, value, previousSecond, second, side);
  }
  if (module.kind === "rsi") {
    if (value == null) return false;
    const low = module.level ?? 30; const high = module.upperLevel ?? 70;
    if (module.rule === "cross_above_level") return previous != null && previous <= low && value > low;
    if (module.rule === "cross_below_level") return previous != null && previous >= high && value < high;
    if (module.rule === "above_level") return value > low;
    if (module.rule === "below_level") return value < high;
    return previous != null && (side === "buy" ? previous <= low && value > low : previous >= high && value < high);
  }
  return false;
}

function groupMatches(group: EntryConditionGroup, lines: Line[], index: number, bars: Bar[], side: "buy" | "sell") {
  if (!group.conditions.length) return false;
  const matches = group.conditions.map(module => moduleMatches(module, lines.find(line => line.module === module) ?? { module, values: [] }, index, bars, side));
  return group.logic === "all" ? matches.every(Boolean) : matches.some(Boolean);
}

function triggerCopy(trigger: EntryTrigger) {
  if (trigger.kind === "immediate") return { icon: "↗", title: "Market · ทันที", detail: "ส่งคำสั่งที่ tick ถัดไป" };
  if (trigger.kind === "delay_seconds") return { icon: "◷", title: `รอ ${trigger.delaySeconds ?? 10}s`, detail: "ครบเวลาแล้วจึงส่งคำสั่ง หาก Setup ยังอยู่" };
  if (trigger.kind === "price_move") return { icon: "↕", title: `รอราคา ${trigger.priceMovePoints ?? 10} points`, detail: trigger.moveDirection === "adverse" ? "รอราคาสวนทางจากจุดสัญญาณ" : "รอราคาไปตามทิศทางจากจุดสัญญาณ" };
  if (trigger.kind === "break_signal_candle") return { icon: "⌁", title: "รอ Break แท่งสัญญาณ", detail: `High/Low + buffer ${trigger.bufferPoints ?? 0} points` };
  if (trigger.kind === "pullback_to_ema") return { icon: "⌒", title: `รอย่อถึง EMA ${trigger.emaPeriod ?? 50}`, detail: "จำลองระดับย่อกลับบนกราฟ" };
  if (trigger.kind === "manual") return { icon: "✋", title: "รอยืนยันเอง", detail: "แสดงสถานะพร้อมเข้าเพื่อให้ผู้ใช้ตรวจสอบ" };
  return { icon: "▤", title: "เปิดแท่งถัดไป", detail: "ส่งคำสั่งที่ราคาเปิดโดยประมาณของแท่งใหม่" };
}

export default function EntryPreviewChart({ strategy, stage, onTimeframeChange }: { strategy: Strategy; stage: "signal" | "trigger"; onTimeframeChange: (timeframe: string) => void }) {
  const [depth, setDepth] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const targetBars = useMemo(() => makeBars(strategy.symbol, strategy.timeframe, 250), [strategy.symbol, strategy.timeframe]);
  const group = strategy.entry.signalGroup ?? EMPTY_GROUP;
  const targetLines = useMemo(() => linesFor(group, targetBars), [group, targetBars]);
  const { bars, lines } = useAnimatedScene(targetBars, targetLines);
  const visibleStart = bars.length - COUNT;
  const visibleBars = bars.slice(visibleStart);
  const rangeValues = visibleBars.flatMap(bar => [bar.high, bar.low]);
  lines.forEach(line => { if (line.module.kind === "ema" || line.module.kind === "ma_cross" || (line.module.kind === "price_cross" && line.module.target !== "price_level")) rangeValues.push(...line.values.slice(visibleStart).filter((value): value is number => value !== null), ...(line.secondValues?.slice(visibleStart).filter((value): value is number => value !== null) ?? [])); });
  const illustrativeSlDistance = Math.max(0.1, strategy.exit.stopLossPips * POINT);
  const illustrativeTpDistance = Math.max(0.1, strategy.exit.takeProfitPips * POINT);
  if (strategy.manage.mode !== "recovery") rangeValues.push(bars.at(-1)!.close - illustrativeSlDistance, bars.at(-1)!.close + illustrativeTpDistance);
  const rawMin = Math.min(...rangeValues); const rawMax = Math.max(...rangeValues);
  const padding = (rawMax - rawMin || 1) * 0.12;
  const min = rawMin - padding; const max = rawMax + padding; const span = max - min || 1;
  const px = (index: number) => LEFT + index * (RIGHT - LEFT) / (COUNT - 1);
  const py = (value: number) => TOP + (max - value) / span * (PRICE_BOTTOM - TOP);
  const candleWidth = (RIGHT - LEFT) / COUNT * 0.58;
  const activeOscillator = lines.find(line => line.module.kind === "rsi" || line.module.kind === "stochastic");
  const oscillatorY = (value: number) => INDICATOR_BOTTOM - value / 100 * (INDICATOR_BOTTOM - INDICATOR_TOP);
  const trigger = strategy.entry.trigger ?? { kind: "next_bar_open" as const };
  const triggerInfo = triggerCopy(trigger);
  const signalIndices: { index: number; side: "buy" | "sell" }[] = [];
  for (let index = visibleStart + 1; index < bars.length; index++) {
    if (strategy.direction !== "sell" && groupMatches(group, lines, index, bars, "buy")) signalIndices.push({ index, side: "buy" });
    if (strategy.direction !== "buy" && groupMatches(group, lines, index, bars, "sell")) signalIndices.push({ index, side: "sell" });
  }
  const lastSignal = signalIndices.at(-1);
  const lastIndex = bars.length - 1;
  const entryIndex = Math.min(lastIndex, (lastSignal?.index ?? lastIndex - 1) + (trigger.kind === "next_bar_open" || trigger.kind === "delay_seconds" ? 1 : 0));
  const entryPrice = trigger.kind === "next_bar_open" || trigger.kind === "delay_seconds" ? bars[entryIndex].open : bars[entryIndex].close;
  const side = lastSignal?.side ?? (strategy.direction === "sell" ? "sell" : "buy");
  const illustrativeSl = entryPrice + (side === "buy" ? -illustrativeSlDistance : illustrativeSlDistance);
  const illustrativeTp = entryPrice + (side === "buy" ? illustrativeTpDistance : -illustrativeTpDistance);
  const triggerLevel = trigger.kind === "break_signal_candle" && lastSignal ? side === "buy" ? bars[lastSignal.index].high + (trigger.bufferPoints ?? 0) * POINT : bars[lastSignal.index].low - (trigger.bufferPoints ?? 0) * POINT : trigger.kind === "price_move" ? entryPrice + (side === "buy" ? 1 : -1) * (trigger.moveDirection === "adverse" ? -1 : 1) * (trigger.priceMovePoints ?? 10) * POINT : trigger.kind === "pullback_to_ema" ? ema(bars.map(bar => bar.close), trigger.emaPeriod ?? 50)[entryIndex] : null;
  const signalLine = (line: Line, second = false) => {
    const values = second ? line.secondValues : line.values;
    if (!values) return "";
    const coords = values.slice(visibleStart).map((value, index) => value == null ? null : `${px(index)},${py(value)}`).filter((value): value is string => value !== null);
    return coords.join(" ");
  };
  const oscLine = (values: (number | null)[]) => values.slice(visibleStart).map((value, index) => value == null ? null : `${px(index)},${oscillatorY(value)}`).filter((value): value is string => value !== null).join(" ");
  const inspected = visibleBars[hoverIndex ?? COUNT - 1];
  const activeModules = group.conditions.map(module => module.kind === "ema" ? `EMA ${module.period ?? 400}` : module.kind === "stochastic" ? `Stoch ${module.period ?? 15}/${module.signalPeriod ?? 2}/${module.slowPeriod ?? 9}` : module.kind === "rsi" ? `RSI ${module.period ?? 14}` : module.kind === "ma_cross" ? `${module.averageType ?? "SMA"} ${module.fastPeriod ?? 20}/${module.slowPeriod ?? 50}` : module.target === "price_level" ? `Price ${module.level ?? 0}` : `Price × ${module.averageType ?? "EMA"} ${module.period ?? 50}`);
  const flowLabel = trigger.kind === "delay_seconds" ? `${trigger.delaySeconds ?? 10}s` : trigger.kind === "price_move" ? `${trigger.priceMovePoints ?? 10} pts` : triggerInfo.title;
  const timeframeMinutes: Record<string, number> = { M1: 1, M5: 5, M15: 15, H1: 60, H4: 240, D1: 1440 };
  const timeLabel = (index: number) => { const minutes = index * (timeframeMinutes[strategy.timeframe] ?? 5); return minutes >= 1440 ? `D${1 + Math.floor(minutes / 1440)}` : `${String(Math.floor(minutes / 60)).padStart(2,"0")}:${String(minutes % 60).padStart(2,"0")}`; };
  return <aside className="entry-preview-card" aria-label="กราฟจำลองแสดงผล Strategy">
    <div className="entry-preview-head"><div><span className="preview-kicker">STRATEGY CANVAS</span><strong>{strategy.symbol}<small> / {strategy.timeframe}</small></strong></div><span className="simulated-badge"><i/> SIMULATION</span></div>
    <div className="preview-toolbar"><div className="preview-timeframes" role="group" aria-label="Timeframe ของ Strategy">{["M1","M5","M15","H1","H4","D1"].map(tf=><button key={tf} type="button" aria-pressed={strategy.timeframe===tf} onClick={()=>onTimeframeChange(tf)}>{tf}</button>)}</div><button type="button" className="preview-depth-button" aria-pressed={depth} onClick={()=>setDepth(value=>!value)}><span aria-hidden="true">◇</span> {depth?"3D":"2D"}</button></div>
    <div className="chart-readout"><span>O <b>{inspected.open.toFixed(2)}</b></span><span>H <b>{inspected.high.toFixed(2)}</b></span><span>L <b>{inspected.low.toFixed(2)}</b></span><span>C <b>{inspected.close.toFixed(2)}</b></span></div>
    <div className={`preview-scene ${depth?"has-depth":""}`} onPointerMove={event=>{if(event.pointerType!=="mouse")return;const rect=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty("--tilt-x",`${-(event.clientY-rect.top-rect.height/2)/rect.height*5}deg`);event.currentTarget.style.setProperty("--tilt-y",`${(event.clientX-rect.left-rect.width/2)/rect.width*5}deg`);}} onPointerLeave={event=>{event.currentTarget.style.setProperty("--tilt-x","0deg");event.currentTarget.style.setProperty("--tilt-y","0deg");setHoverIndex(null);}}>
    <div className="preview-chart-plane">
    <svg className="entry-preview-svg" viewBox={`0 0 ${W} ${H}`} onPointerMove={event=>{const rect=event.currentTarget.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*W;setHoverIndex(Math.max(0,Math.min(COUNT-1,Math.round((x-LEFT)/(RIGHT-LEFT)*(COUNT-1)))));}} role="img" aria-label={`กราฟแท่งเทียนจำลอง ${strategy.symbol} ${strategy.timeframe} แสดงเส้น Indicator และจังหวะเข้า`}>
      <defs>
        <linearGradient id="candle-up" x1="0" x2="1"><stop stopColor="#138b85"/><stop offset=".38" stopColor="#5af3cc"/><stop offset="1" stopColor="#25baa4"/></linearGradient>
        <linearGradient id="candle-down" x1="0" x2="1"><stop stopColor="#953a70"/><stop offset=".38" stopColor="#ff93b6"/><stop offset="1" stopColor="#e75d96"/></linearGradient>
        <linearGradient id="preview-bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#10172d"/><stop offset="1" stopColor="#1a2140"/></linearGradient><linearGradient id="preview-glow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#41d5c2" stopOpacity=".14"/><stop offset="1" stopColor="#41d5c2" stopOpacity="0"/></linearGradient><filter id="preview-shadow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect x="0" y="0" width={W} height={H} rx="12" fill="url(#preview-bg)"/>
      {[0,1,2,3].map(tick=>{const y=TOP+(PRICE_BOTTOM-TOP)*tick/3;return <g key={tick}><line x1={LEFT} x2={RIGHT} y1={y} y2={y} stroke="#ffffff" strokeOpacity=".075"/><text x="8" y={y+4} fill="#818ba9" fontSize="9">{(max-span*tick/3).toFixed(1)}</text></g>})}
      <rect x={LEFT} y={TOP} width={RIGHT-LEFT} height={PRICE_BOTTOM-TOP} fill="url(#preview-glow)"/>
      {[0,1,2,3,4,5,6].map(tick=><line key={`vertical-${tick}`} x1={LEFT+(RIGHT-LEFT)*tick/6} x2={LEFT+(RIGHT-LEFT)*tick/6} y1={TOP} y2={PRICE_BOTTOM} stroke="#ffffff" strokeOpacity=".035"/>)}
      {visibleBars.map((bar,index)=>{const x=px(index);const up=bar.close>=bar.open;const y1=py(Math.max(bar.open,bar.close));const y2=Math.max(y1+1.5,py(Math.min(bar.open,bar.close)));const left=x-candleWidth/2;const right=x+candleWidth/2;return <g key={index} className="chart-candle"><line x1={x} x2={x} y1={py(bar.high)} y2={py(bar.low)} stroke={up?"#65e8cc":"#ef83b2"} strokeWidth="1.2"/><rect x={left} y={y1} width={candleWidth} height={y2-y1} rx=".65" fill={depth?(up?"url(#candle-up)":"url(#candle-down)"):(up?"#48dbc4":"#f47ba8")}/>{depth&&<><path d={`M ${left} ${y1} l 2.5 -2 h ${candleWidth} l -2.5 2 z`} fill={up?"#adffe8":"#ffc4df"}/><path d={`M ${right} ${y1} l 2.5 -2 v ${y2-y1} l -2.5 2 z`} fill={up?"#13766f":"#8f3a65"}/><line x1={left+.7} x2={left+.7} y1={y1+1} y2={y2-1} stroke="#ffffff" strokeOpacity=".35" strokeWidth=".6"/></>}</g>})}
      {lines.filter(line=>line.module.kind==="ema"||line.module.kind==="ma_cross"||(line.module.kind==="price_cross"&&line.module.target!=="price_level")).map((line,index)=><g key={`${line.module.kind}-${index}`}><polyline points={signalLine(line)} transform="translate(0 3)" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="4"/><polyline className="preview-indicator-line" points={signalLine(line)} fill="none" stroke={index%2===0?"#9b8cff":"#47d7ca"} strokeWidth={line.module.kind==="ema"?2:1.4} strokeLinejoin="round" strokeLinecap="round"/>{line.secondValues&&<polyline points={signalLine(line,true)} fill="none" stroke="#f6bc68" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round"/>}<text x={RIGHT-5} y={TOP+13+index*13} textAnchor="end" fill={index%2===0?"#b7aaff":"#66e1d4"} fontSize="8">{line.module.kind==="ema"?`EMA ${line.module.period}`:line.module.kind==="ma_cross"?`${line.module.averageType} ${line.module.fastPeriod}/${line.module.slowPeriod}`:`${line.module.averageType} ${line.module.period}`}</text></g>)}
      {lines.filter(line=>line.module.kind==="price_cross"&&line.module.target==="price_level"&&line.module.level).map((line,index)=><g key={`price-level-${index}`}><line x1={LEFT} x2={RIGHT} y1={Math.max(TOP,Math.min(PRICE_BOTTOM,py(line.module.level!)))} y2={Math.max(TOP,Math.min(PRICE_BOTTOM,py(line.module.level!)))} stroke="#f6bc68" strokeDasharray="5 5"/><text x={LEFT+6} y={Math.max(TOP+12,Math.min(PRICE_BOTTOM-4,py(line.module.level!)-5))} fill="#f6bc68" fontSize="9">PRICE LEVEL · {line.module.level}</text></g>)}
      {signalIndices.filter(signal=>signal.index>=visibleStart).map((signal,index)=>{const i=signal.index-visibleStart;const x=px(i);const y=py(signal.side==="buy"?bars[signal.index].low:bars[signal.index].high)+(signal.side==="buy"?8:-8);return <g key={`${signal.index}-${signal.side}`} opacity={index===signalIndices.length-1?.96:.66}><circle cx={x} cy={y} r="6" fill={signal.side==="buy"?"#36cdb3":"#ff7692"} fillOpacity=".22" filter="url(#preview-shadow)"/><path d={signal.side==="buy"?`M ${x} ${y-5} l 4 5 h -2 v 5 h -4 v -5 h -2 z`:`M ${x} ${y+5} l 4 -5 h -2 v -5 h -4 v 5 h -2 z`} fill={signal.side==="buy"?"#52e2c9":"#ff8da4"}/></g>})}
      {lastSignal&&<g><line x1={px(entryIndex-visibleStart)} x2={RIGHT} y1={py(entryPrice)} y2={py(entryPrice)} stroke="#a794ff" strokeWidth="1" strokeDasharray="4 4"/><rect x={Math.max(LEFT,px(entryIndex-visibleStart)-32)} y={py(entryPrice)-13} width="66" height="17" rx="5" fill="#7a68e8"/><text x={Math.max(LEFT,px(entryIndex-visibleStart)-28)} y={py(entryPrice)-2} fill="white" fontSize="8">ENTRY · {side.toUpperCase()}</text></g>}
      {strategy.manage.mode !== "recovery"&&<g className="preview-exit-levels"><line x1={Math.max(LEFT,px(entryIndex-visibleStart)-5)} x2={RIGHT} y1={py(illustrativeTp)} y2={py(illustrativeTp)} stroke="#48dbc4" strokeWidth="1" strokeDasharray="3 5" opacity=".8"/><rect x={RIGHT-42} y={py(illustrativeTp)-9} width="39" height="13" rx="4" fill="#246c67"/><text x={RIGHT-22.5} y={py(illustrativeTp)} textAnchor="middle" fill="white" fontSize="7">TP</text><line x1={Math.max(LEFT,px(entryIndex-visibleStart)-5)} x2={RIGHT} y1={py(illustrativeSl)} y2={py(illustrativeSl)} stroke="#ff708d" strokeWidth="1" strokeDasharray="3 5" opacity=".8"/><rect x={RIGHT-42} y={py(illustrativeSl)-9} width="39" height="13" rx="4" fill="#804458"/><text x={RIGHT-22.5} y={py(illustrativeSl)} textAnchor="middle" fill="white" fontSize="7">SL</text></g>}
      {strategy.manage.mode === "recovery"&&<g><rect x={LEFT+5} y={TOP+5} width="128" height="20" rx="6" fill="#ffffff10" stroke="#ffffff22"/><text x={LEFT+12} y={TOP+18} fill="#c9c3ff" fontSize="8">BASKET TP / SL · MONEY</text></g>}
      {triggerLevel!=null&&<g><line x1={Math.max(LEFT,px(entryIndex-visibleStart)-16)} x2={RIGHT} y1={py(triggerLevel)} y2={py(triggerLevel)} stroke="#f5bd63" strokeWidth="1.4" strokeDasharray="5 4"/><rect x={RIGHT-63} y={py(triggerLevel)-11} width="60" height="16" rx="5" fill="#aa7739"/><text x={RIGHT-33} y={py(triggerLevel)} textAnchor="middle" fill="white" fontSize="8">TRIGGER</text></g>}
      {stage==="trigger"&&<g transform={`translate(${Math.max(LEFT+4,Math.min(RIGHT-87,px(Math.max(0,entryIndex-visibleStart)-2)))},${Math.max(TOP+5,py(entryPrice)-40)})`}><rect width="82" height="27" rx="7" fill="#322c5e" stroke="#9b8cff" strokeOpacity=".7"/><text x="11" y="18" fill="#d8d1ff" fontSize="13">{triggerInfo.icon}</text><text x="29" y="17" fill="white" fontSize="9" fontWeight="700">{trigger.kind==="delay_seconds"?`${trigger.delaySeconds??10}s`:trigger.kind==="price_move"?`${trigger.priceMovePoints??10} pts`:trigger.kind==="immediate"?"NEXT TICK":trigger.kind==="manual"?"MANUAL":"ENTRY"}</text></g>}
      {activeOscillator&&<g><line x1={LEFT} x2={RIGHT} y1={INDICATOR_TOP} y2={INDICATOR_TOP} stroke="#ffffff" strokeOpacity=".14"/><line x1={LEFT} x2={RIGHT} y1={INDICATOR_BOTTOM} y2={INDICATOR_BOTTOM} stroke="#ffffff" strokeOpacity=".14"/><text x="8" y={INDICATOR_TOP+7} fill="#8d98b7" fontSize="8">{activeOscillator.module.kind==="rsi"?`RSI ${activeOscillator.module.period}`:`STOCH ${activeOscillator.module.period}/${activeOscillator.module.signalPeriod}/${activeOscillator.module.slowPeriod}`}</text><polyline points={oscLine(activeOscillator.values)} fill="none" stroke="#ae9cff" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>{activeOscillator.secondValues&&<polyline points={oscLine(activeOscillator.secondValues)} fill="none" stroke="#52dcca" strokeWidth="1.2" strokeLinejoin="round"/>}<line x1={LEFT} x2={RIGHT} y1={oscillatorY(70)} y2={oscillatorY(70)} stroke="#ffffff" strokeOpacity=".08" strokeDasharray="3 4"/><line x1={LEFT} x2={RIGHT} y1={oscillatorY(30)} y2={oscillatorY(30)} stroke="#ffffff" strokeOpacity=".08" strokeDasharray="3 4"/></g>}
      {hoverIndex!==null&&<g pointerEvents="none"><line x1={px(hoverIndex)} x2={px(hoverIndex)} y1={TOP} y2={INDICATOR_BOTTOM} stroke="#c9c3ff" strokeOpacity=".55" strokeDasharray="3 4"/><circle cx={px(hoverIndex)} cy={py(visibleBars[hoverIndex].close)} r="3.5" fill="#e4ddff" stroke="#8c73ff" strokeWidth="2"/></g>}
      {[0,1,2,3].map(tick=><text key={`time-${tick}`} x={LEFT+(RIGHT-LEFT)*tick/3} y={PRICE_BOTTOM+14} textAnchor={tick===0?"start":tick===3?"end":"middle"} fill="#7d89a8" fontSize="8">{timeLabel(Math.round((COUNT-1)*tick/3))}</text>)}
      <text x={LEFT} y={H-8} fill="#8792ae" fontSize="8">{strategy.timeframe} · simulated candles</text><text x={RIGHT} y={H-8} textAnchor="end" fill="#8792ae" fontSize="8">ILLUSTRATIVE · {depth?"DEPTH VIEW":"FLAT VIEW"}</text>
    </svg>
    </div><div className="preview-scene-floor" aria-hidden="true"/></div>
    <div className="preview-module-chips" aria-label="Indicator ที่เลือก">{activeModules.length?activeModules.map((label,index)=><span key={`${index}-${label}`}><i/>{label}</span>):<span>เพิ่ม Indicator เพื่อเริ่มวาด Setup</span>}</div>
    <div className="preview-flow" aria-label="ลำดับการเข้าไม้"><div className={stage==="signal"?"active":""}><span>01</span><strong>SETUP</strong><small>{group.logic.toUpperCase()} · {group.conditions.length} เงื่อนไข</small></div><b aria-hidden="true">→</b><div className={stage==="trigger"?"active":""}><span>{triggerInfo.icon}</span><strong>TRIGGER</strong><small>{flowLabel}</small></div><b aria-hidden="true">→</b><div><span>↗</span><strong>ENTRY</strong><small>จำลองจังหวะเข้า</small></div></div>
    <div className="preview-trigger-summary"><span className={`preview-state-light ${signalIndices.length?"ready":"waiting"}`}/><div><strong>{stage==="signal"?(signalIndices.length?"ตัวอย่างแท่งที่ผ่าน Setup":"กำลังแสดง Setup ตามโมดูลที่เลือก"):`${triggerInfo.icon} ${triggerInfo.title}`}</strong><small>{stage==="signal"?`รวม ${group.logic.toUpperCase()} · ${group.conditions.length} โมดูล · แสดงสัญญาณตัวอย่างตามกราฟจำลอง`:triggerInfo.detail}</small></div></div>
    <p className="preview-disclaimer">กราฟและลูกศรสร้างจากข้อมูลจำลอง เพื่ออธิบายการตั้งค่าเท่านั้น · ไม่ใช่ราคาตลาด, สัญญาณสด หรือผล Backtest</p>
  </aside>;
}
