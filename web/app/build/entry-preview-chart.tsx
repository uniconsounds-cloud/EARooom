"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Strategy } from "@/lib/strategy/model";
import { evaluateGroup, linesFor, triggerFor, withExit, TF_SECONDS, type Bar, type Line, type Side } from "@/lib/strategy/evaluator";
import { generateScenario } from "@/lib/strategy/scenario";
const EMPTY_GROUP = { logic: "all" as const, conditions: [] };
const W=760, LEFT=48, RIGHT=738, TOP=26, BOTTOM=272, COUNT=64;
const colors=["#b3a0ff","#62dfc9","#f6bd72","#f48aad"];
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
        const old = from.bars[i + from.bars.length - targetBars.length] ?? bar;
        return { open: mix(old.open, bar.open, t), close: mix(old.close, bar.close, t), high: mix(old.high, bar.high, t), low: mix(old.low, bar.low, t) };
      });
      const lines = targetLines.map((line, i) => {
        const old = from.lines[i]?.module.kind === line.module.kind ? from.lines[i] : undefined;
        const interpolate = (values: (number | null)[], previous?: (number | null)[]) => values.map((value, index) => value === null ? null : mix(previous?.[index + previous.length - values.length] ?? value, value, t));
        return { ...line, values: interpolate(line.values, old?.values), secondValues: line.secondValues ? interpolate(line.secondValues, old?.secondValues) : undefined };
      });
      displayed.current = { bars, lines };
      setScene(displayed.current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetBars, targetLines]);
  return scene.bars.length === targetBars.length ? scene : { bars: targetBars, lines: targetLines };
}


export default function EntryPreviewChart({strategy,stage,onTimeframeChange}:{strategy:Strategy;stage:"signal"|"trigger";onTimeframeChange:(timeframe:string)=>void}) {
  const [variation,setVariation]=useState(0);
  const [hover,setHover]=useState<number|null>(null);
  const group=strategy.entry.signalGroup??EMPTY_GROUP;
  const scenario=useMemo(()=>generateScenario(strategy,variation),[strategy,variation]);
  const targetLines=useMemo(()=>linesFor(group,scenario.bars),[group,scenario.bars]);
  const scene=useAnimatedScene(scenario.bars,targetLines);
  const bars=scene.bars,lines=scene.lines,start=bars.length-COUNT,visible=bars.slice(start);
  const analysis=useMemo(()=>{
    const signals:{index:number;side:Side}[]=[],entries:ReturnType<typeof withExit>[]=[];
    let nextAllowed=start;
    const previous={buy:false,sell:false};
    for(let i=start;i<scenario.bars.length;i++){
      const readySides:Side[]=[];
      for(const side of (["buy","sell"] as const)){
        if(strategy.direction!=="both"&&strategy.direction!==side)continue;
        const ready=evaluateGroup(group,targetLines,i,scenario.bars,side).passed;
        if(ready&&!previous[side]){signals.push({index:i,side});readySides.push(side);}
        previous[side]=ready;
      }
      if(i<nextAllowed||!readySides.length)continue;
      const event=triggerFor(strategy,scenario.bars,i,readySides[0]);
      if(event){const resolved=withExit(strategy,scenario.bars,event);entries.push(resolved);nextAllowed=resolved.exitIndex!==undefined?resolved.exitIndex+1:scenario.bars.length;}
    }
    return {signals,entries};
  },[group,targetLines,scenario.bars,strategy,start]);
  const active=analysis.entries.find(e=>!e.pending)??analysis.entries[0];
  const focus=hover===null?scenario.focus:start+hover;
  const side:Side=strategy.direction==="sell"?"sell":strategy.direction==="buy"?"buy":evaluateGroup(group,targetLines,focus,scenario.bars,"buy").count>=evaluateGroup(group,targetLines,focus,scenario.bars,"sell").count?"buy":"sell";
  const match=evaluateGroup(group,targetLines,focus,scenario.bars,side);
  const oscillators=lines.filter(l=>l.module.kind==="rsi"||l.module.kind==="stochastic");
  const height=320+oscillators.length*72;
  const priceLines=lines.filter(l=>l.module.kind==="ema"||l.module.kind==="ma_cross"||l.module.kind==="price_cross");
  const prices=visible.flatMap(b=>[b.high,b.low]);
  priceLines.forEach(l=>prices.push(...l.values.slice(start).filter((v):v is number=>v!==null),...(l.secondValues?.slice(start).filter((v):v is number=>v!==null)??[])));
  if(active?.stopLoss)prices.push(active.stopLoss);if(active?.takeProfit)prices.push(active.takeProfit);
  const low=Math.min(...prices),high=Math.max(...prices),padding=(high-low||1)*.1;
  const y=(v:number)=>TOP+(high+padding-v)/(high-low+padding*2)*(BOTTOM-TOP);
  const x=(i:number)=>LEFT+(i-start)/(COUNT-1)*(RIGHT-LEFT);
  const path=(values:(number|null)[],toY:(n:number)=>number=y)=>values.slice(start).map((v,i)=>v===null?null:`${x(start+i)},${toY(v)}`).filter(Boolean).join(" ");
  const t=strategy.entry.trigger??{kind:"next_bar_open"};
  const triggerLabel=({immediate:"ทันที · tick ถัดไป",next_bar_open:"เปิดแท่งถัดไป",delay_seconds:`◷ ${t.delaySeconds??10}s`,price_move:`↕ ${t.priceMovePoints??10} points`,break_signal_candle:"Break แท่งสัญญาณ",pullback_to_ema:`ย่อกลับ EMA ${t.emaPeriod??50}`,manual:"รอยืนยันเอง",candle_reversal:"รอแท่งกลับตัว"})[t.kind];
  const read=bars[focus]??bars.at(-1)!;
  return <aside className="entry-preview-card" aria-label="กราฟจำลองแสดงผล Strategy">
    <div className="entry-preview-head"><div><span className="preview-kicker">STRATEGY CANVAS · 2D</span><strong>{strategy.symbol}<small> / {strategy.timeframe}</small></strong></div><span className="simulated-badge"><i/> SIMULATION</span></div>
    <div className="preview-toolbar"><div className="preview-timeframes" role="group" aria-label="Timeframe ของ Strategy">{Object.keys(TF_SECONDS).map(tf=><button key={tf} type="button" aria-pressed={strategy.timeframe===tf} onClick={()=>onTimeframeChange(tf)}>{tf}</button>)}</div><button className="preview-scenario-button" type="button" onClick={()=>{setHover(null);setVariation(v=>v+1);}}>↻ สถานการณ์ใหม่</button></div>
    <div className="chart-readout"><span>O {read.open.toFixed(2)}</span><span>H {read.high.toFixed(2)}</span><span>L {read.low.toFixed(2)}</span><span>C {read.close.toFixed(2)}</span></div>
    <div className="preview-scene" onPointerLeave={()=>setHover(null)}><div className="preview-chart-plane">
    <svg className="entry-preview-svg" viewBox={`0 0 ${W} ${height}`} onPointerMove={event=>{const r=event.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(COUNT-1,Math.round(((event.clientX-r.left)/r.width*W-LEFT)/(RIGHT-LEFT)*(COUNT-1)))));}} role="img" aria-label="กราฟแท่งเทียนจำลอง พร้อมสัญญาณ Trigger จุดเข้าและจุดออกที่ผ่านกติกา">
      <rect width={W} height={height} rx="12" fill="#121b31"/>
      {[0,1,2,3,4].map(i=><g key={i}><line x1={LEFT} x2={RIGHT} y1={TOP+(BOTTOM-TOP)*i/4} y2={TOP+(BOTTOM-TOP)*i/4} stroke="#ffffff0e"/><text x="5" y={TOP+(BOTTOM-TOP)*i/4+3} fill="#8493b4" fontSize="8">{(high+padding-(high-low+padding*2)*i/4).toFixed(1)}</text></g>)}
      {visible.map((b,i)=>{const up=b.close>=b.open;return <g key={i}><line x1={x(start+i)} x2={x(start+i)} y1={y(b.high)} y2={y(b.low)} stroke={up?"#52d8be":"#f581aa"}/><rect x={x(start+i)-3} y={y(Math.max(b.open,b.close))} width="6" height={Math.max(1.2,Math.abs(y(b.open)-y(b.close)))} rx=".5" fill={up?"#52d8be":"#f581aa"}/></g>})}
      {priceLines.map((l,i)=><g key={i}><polyline points={path(l.values)} fill="none" stroke={colors[i%4]} strokeWidth="1.8" strokeDasharray={l.module.target==="price_level"?"5 4":undefined}/>{l.secondValues&&<polyline points={path(l.secondValues)} fill="none" stroke="#edbb70" strokeWidth="1.4"/>}</g>)}
      {analysis.signals.map(s=><g key={`${s.index}-${s.side}`}><circle cx={x(s.index)} cy={y(s.side==="buy"?bars[s.index].low:bars[s.index].high)+(s.side==="buy"?9:-9)} r="4" fill="none" stroke="#c1acff" strokeWidth="1.8"/></g>)}
      {analysis.entries.filter(e=>!e.pending).map((e,i)=><g key={i}><path d={`M ${x(e.index)} ${y(e.price)-16} v 11 m -4 -4 l 4 4 l 4 -4`} fill="none" stroke="#fbc775" strokeWidth="2"/><text x={Math.min(RIGHT-100,Math.max(LEFT,x(e.index)))} y={y(e.price)-21} fill="#fbc775" fontSize="9">{e.side.toUpperCase()} · {triggerLabel}</text>{e.exitIndex!==undefined&&<><circle cx={x(e.exitIndex)} cy={y(e.exitPrice??e.price)} r="5" fill="#151f36" stroke={e.exitReason==="TP"?"#55ddbf":"#f18aab"}/><text x={Math.min(RIGHT-50,x(e.exitIndex)+6)} y={y(e.exitPrice??e.price)-8} fill="#d0c4f2" fontSize="9">{e.exitReason==="ambiguous"?"TP/SL ?":e.exitReason}</text></>}</g>)}
      {active&&!active.pending&&[active.stopLoss,active.takeProfit].map((v,i)=>v===undefined?null:<g key={i}><line x1={x(active.index)} x2={RIGHT} y1={y(v)} y2={y(v)} stroke={i?"#55ddbf":"#f18aab"} strokeDasharray="4 5" opacity=".7"/><text x={RIGHT-4} y={y(v)-5} fill={i?"#55ddbf":"#f18aab"} fontSize="9" textAnchor="end">{i?"TP":"SL"}</text></g>)}
      {oscillators.map((l,j)=>{const top=306+j*72,toY=(v:number)=>top+44-v/100*44;return <g key={j}><rect x={LEFT} y={top} width={RIGHT-LEFT} height="44" fill="#ffffff03"/><text x="5" y={top+9} fill="#9aabca" fontSize="8">{l.module.kind==="rsi"?"RSI":"STOCH"}</text>{[l.module.level??30,l.module.upperLevel??70].map((n,k)=><line key={k} x1={LEFT} x2={RIGHT} y1={toY(n)} y2={toY(n)} stroke="#ffffff1c" strokeDasharray="3 5"/>)}<polyline points={path(l.values,toY)} fill="none" stroke={colors[j%4]} strokeWidth="1.6"/>{l.secondValues&&<polyline points={path(l.secondValues,toY)} fill="none" stroke="#65d7ca" strokeWidth="1.2"/>}</g>})}
      <line x1={x(focus)} x2={x(focus)} y1={TOP} y2={height-23} stroke="#c8bbff55" strokeDasharray="3 4"/>
      <text x={LEFT} y={height-8} fill="#8595b6" fontSize="9">{strategy.timeframe} · GENERATED SCENARIO</text><text x={RIGHT} y={height-8} textAnchor="end" fill="#8595b6" fontSize="9">○ SETUP · ↓ ENTRY · ◇ EXIT</text>
    </svg></div></div>
    <div className="preview-condition-status"><strong>{side.toUpperCase()} · ผ่าน {match.count}/{match.total} เงื่อนไข <small>({group.logic.toUpperCase()})</small></strong><div>{group.conditions.map((m,i)=><span className={match.matches[i]?"matched":""} key={i}>{match.matches[i]?"✓":"○"} {m.kind==="ema"?`EMA ${m.period??400}`:m.kind==="stochastic"?`Stoch ${m.period??15}`:m.kind==="rsi"?`RSI ${m.period??14}`:m.kind==="ma_cross"?"MA cross":"Price cross"}</span>)}</div></div>
    <div className="preview-flow"><div className={stage==="signal"?"active":""}><span>01</span><strong>SETUP</strong><small>{match.passed?"สัญญาณพร้อม":"รอเงื่อนไขครบ"}</small></div><b>→</b><div className={stage==="trigger"?"active":""}><span>02</span><strong>TRIGGER</strong><small>{triggerLabel}</small></div><b>→</b><div><span>↗</span><strong>ENTRY</strong><small>{analysis.entries.some(e=>!e.pending)?"มีตัวอย่างจุดเข้า":"ยังไม่มีจุดเข้า"}</small></div></div>
    {analysis.signals.length===0&&<p className="preview-disclaimer">สถานการณ์นี้ยังไม่ผ่านกติกาครบ ลองเปลี่ยนสถานการณ์หรือตรวจว่าเงื่อนไขขัดกันหรือไม่</p>}
    {active?.pending&&<p className="preview-disclaimer">{active.pending}</p>}
    {strategy.manage.mode==="recovery"&&<p className="preview-disclaimer">แสดง Entry ของไม้แรก · การเพิ่มไม้และ Basket Exit ยังไม่จำลอง</p>}
    <p className="preview-disclaimer">ข้อมูลจำลองทองคำ: point 0.01 / pip 0.1 · ไม่มี spread/slippage · จังหวะภายในแท่งเป็นภาพประกอบ · หาก TP/SL อยู่ในแท่งเดียวกันจะแสดง ? · ไม่ใช่ผล Backtest</p>
  </aside>;
}
