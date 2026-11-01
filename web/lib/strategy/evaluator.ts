import type { EntryModule, EntryConditionGroup, Strategy } from "./model";

export type Bar = { open: number; high: number; low: number; close: number };
export type Side = "buy" | "sell";
export type Line = { module: EntryModule; values: (number | null)[]; secondValues?: (number | null)[] };
export const TF_SECONDS: Record<string, number> = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };
export const RULES: Record<EntryModule["kind"], readonly string[]> = {
  ema: ["with_direction","price_above","price_below","slope_with_direction"],
  stochastic: ["cross_for_direction","extreme_for_direction","k_above_d","k_below_d"],
  rsi: ["recover_for_direction","cross_above_level","cross_below_level","above_level","below_level"],
  ma_cross: ["cross_for_direction","cross_up","cross_down"],
  price_cross: ["cross_for_direction","cross_up","cross_down"],
};
export function period(n: number | undefined, fallback: number) { return Math.max(1, Math.min(2000, Math.floor(Number.isFinite(n) ? n! : fallback))); }
export function sma(values: (number|null)[], n: number): (number|null)[] {
  n=period(n,14);let sum=0,valid=0;
  return values.map((v,i)=>{if(v!==null){sum+=v;valid++;}if(i>=n&&values[i-n]!==null){sum-=values[i-n]!;valid--;}return i>=n-1&&valid===n?sum/n:null;});
}
export function ema(values: number[], n: number): (number|null)[] {
  n=period(n,50);let current:number|null=null,sum=0;const a=2/(n+1);
  return values.map((v,i)=>{sum+=v;if(i<n-1)return null;current=current===null?sum/n:v*a+current*(1-a);return current;});
}
export function rsi(values: number[], n: number): (number|null)[] {
  n=period(n,14);let gain=0,loss=0;
  return values.map((v,i)=>{if(!i)return null;const d=v-values[i-1],g=Math.max(0,d),l=Math.max(0,-d);if(i<=n){gain+=g;loss+=l;if(i<n)return null;gain/=n;loss/=n;}else{gain=(gain*(n-1)+g)/n;loss=(loss*(n-1)+l)/n;}return loss===0?(gain===0?50:100):100-100/(1+gain/loss);});
}
export function linesFor(group: EntryConditionGroup, bars: Bar[]): Line[] {
  const close=bars.map(b=>b.close);
  return group.conditions.map(module=>{
    const ma=module.averageType==="SMA"?sma:ema;
    if(module.kind==="ema")return {module,values:ema(close,module.period??400)};
    if(module.kind==="ma_cross")return {module,values:(module.averageType==="EMA"?ema:sma)(close,module.fastPeriod??20),secondValues:(module.averageType==="EMA"?ema:sma)(close,module.slowPeriod??50)};
    if(module.kind==="price_cross")return {module,values:module.target==="price_level"?bars.map(()=>module.level??0):ma(close,module.period??50)};
    if(module.kind==="rsi")return {module,values:rsi(close,module.period??14)};
    const n=period(module.period,15),lowQueue:number[]=[],highQueue:number[]=[];let lo=0,hi=0;
    const raw=bars.map((b,i)=>{while(lowQueue.length>lo&&bars[lowQueue.at(-1)!].low>=b.low)lowQueue.pop();while(highQueue.length>hi&&bars[highQueue.at(-1)!].high<=b.high)highQueue.pop();lowQueue.push(i);highQueue.push(i);while(lowQueue[lo]<=i-n)lo++;while(highQueue[hi]<=i-n)hi++;if(i<n-1)return null;const low=bars[lowQueue[lo]].low,high=bars[highQueue[hi]].high;return high===low?50:100*(b.close-low)/(high-low);});
    const k=sma(raw,period(module.slowPeriod,9));return {module,values:k,secondValues:sma(k,period(module.signalPeriod,2))};
  });
}
export function cross(a0:number|null|undefined,a1:number|null|undefined,b0:number|null|undefined,b1:number|null|undefined,side:Side) {
  if(a0==null||a1==null||b0==null||b1==null)return false;
  return side==="buy"?a0<=b0&&a1>b1:a0>=b0&&a1<b1;
}
export function moduleMatches(module:EntryModule,line:Line,i:number,bars:Bar[],side:Side):boolean {
  if(!bars[i]||i<1)return false;
  const v=line.values[i],p=line.values[i-1],d=line.secondValues?.[i],pd=line.secondValues?.[i-1];if(v==null)return false;
  const rule=module.rule??({ema:"with_direction",stochastic:"cross_for_direction",rsi:"recover_for_direction",ma_cross:"cross_for_direction",price_cross:"cross_for_direction"}[module.kind]);
  if(!RULES[module.kind]?.includes(rule))return false;
  if(module.kind==="ema")return rule==="price_above"?bars[i].close>v:rule==="price_below"?bars[i].close<v:rule==="slope_with_direction"?p!=null&&(side==="buy"?v>p:v<p):side==="buy"?bars[i].close>v:bars[i].close<v;
  const direction=rule==="cross_up"?"buy":rule==="cross_down"?"sell":side;
  if(module.kind==="ma_cross")return cross(p,v,pd,d,direction);
  if(module.kind==="price_cross")return cross(bars[i-1].close,bars[i].close,p,v,direction);
  if(module.kind==="stochastic")return rule==="k_above_d"?d!=null&&v>d:rule==="k_below_d"?d!=null&&v<d:rule==="extreme_for_direction"?side==="buy"?v<=(module.level??20):v>=(module.upperLevel??80):cross(p,v,pd,d,side);
  const low=module.level??30,high=module.upperLevel??70;
  if(rule==="above_level")return v>low;if(rule==="below_level")return v<high;
  return rule==="cross_above_level"?cross(p,v,low,low,"buy"):rule==="cross_below_level"?cross(p,v,high,high,"sell"):side==="buy"?cross(p,v,low,low,"buy"):cross(p,v,high,high,"sell");
}
export function evaluateGroup(group:EntryConditionGroup,lines:Line[],i:number,bars:Bar[],side:Side) {
  const matches=group.conditions.map((m,j)=>moduleMatches(m,lines[j],i,bars,side));
  return {matches,count:matches.filter(Boolean).length,total:matches.length,passed:matches.length>0&&(group.logic==="all"?matches.every(Boolean):matches.some(Boolean))};
}
export function historyLength(strategy:Strategy) {
  const ns=[period(strategy.exit.swingLookbackBars,10),period(strategy.entry.trigger?.emaPeriod,50),...(strategy.entry.signalGroup?.conditions??[]).flatMap(m=>[period(m.period,m.kind==="ema"?400:m.kind==="price_cross"?50:m.kind==="stochastic"?15:14),period(m.slowPeriod,50),period(m.fastPeriod,20)])];
  return Math.min(6200,Math.max(250,...ns.map(n=>n*3+70)));
}
export type TriggerEvent = { signalIndex:number; index:number; fraction:number; price:number; side:Side; stopLoss?:number; takeProfit?:number; exitIndex?:number; exitPrice?:number; exitReason?:"TP"|"SL"|"ambiguous"; pending?:string };
export function triggerFor(strategy:Strategy,bars:Bar[],signalIndex:number,side:Side,point=.01):TriggerEvent|null {
  const t=strategy.entry.trigger??{kind:"next_bar_open"},sign=side==="buy"?1:-1,ref=bars[signalIndex];if(!ref)return null;
  const base={signalIndex,index:signalIndex,fraction:1,price:ref.close,side};
  if(t.kind==="manual")return {...base,pending:"รอยืนยันด้วยตนเอง"};
  if(t.kind==="immediate")return bars[signalIndex+1]?{...base,index:signalIndex+1,fraction:0,price:bars[signalIndex+1].open}:null;
  if(t.kind==="next_bar_open")return bars[signalIndex+1]?{...base,index:signalIndex+1,fraction:0,price:bars[signalIndex+1].open}:null;
  const group=strategy.entry.signalGroup??{logic:"all",conditions:[]},lines=linesFor(group,bars),wait=period(t.maxWaitBars,3),emaLine=t.kind==="pullback_to_ema"?ema(bars.map(b=>b.close),t.emaPeriod??50):[];
  const seconds=TF_SECONDS[strategy.timeframe]??300;
  for(let i=signalIndex+1;i<Math.min(bars.length,signalIndex+wait+1);i++){
    // Closed-bar Setup is rechecked before each waiting bar, as in the EA.
    if(!evaluateGroup(group,lines,i-1,bars,side).passed)return null;
    if(t.kind==="delay_seconds"){const elapsed=(i-signalIndex-1)*seconds,delay=t.delaySeconds??10;if(delay<elapsed+seconds)return {...base,index:i,fraction:(delay-elapsed)/seconds,price:bars[i].open+(bars[i].close-bars[i].open)*(delay-elapsed)/seconds};}
    const target=t.kind==="price_move"?ref.close+sign*(t.moveDirection==="adverse"?-1:1)*(t.priceMovePoints??10)*point:t.kind==="break_signal_candle"?(side==="buy"?ref.high:ref.low)+sign*(t.bufferPoints??0)*point:emaLine[i-1];
    if(target==null)continue;
    const crossed=t.kind==="pullback_to_ema"?bars[i].low<=target+(t.bufferPoints??0)*point&&bars[i].high>=target-(t.bufferPoints??0)*point:(side==="buy")!==(t.kind==="price_move"&&t.moveDirection==="adverse")?bars[i].high>=target:bars[i].low<=target;
    if(crossed)return {...base,index:i,fraction:.5,price:target};
  }
  return null;
}
export function withExit(strategy:Strategy,bars:Bar[],event:TriggerEvent,point=.01,pipSize=.1):TriggerEvent {
  if(event.pending||strategy.manage.mode==="recovery")return event;
  const sign=event.side==="buy"?1:-1;let stop=event.price-sign*strategy.exit.stopLossPips*pipSize;
  if(strategy.exit.stopMode==="swing"){
    const window=bars.slice(Math.max(0,event.signalIndex-period(strategy.exit.swingLookbackBars,10)+1),event.signalIndex+1);
    stop=(event.side==="buy"?Math.min(...window.map(b=>b.low)):Math.max(...window.map(b=>b.high)))-sign*(strategy.exit.swingBufferPoints??0)*point;
  }
  if((event.price-stop)*sign<=0)return {...event,pending:"ตำแหน่ง SL ไม่อยู่ฝั่งขาดทุน"};
  const take=strategy.exit.stopMode==="swing"?event.price+sign*Math.abs(event.price-stop)*(strategy.exit.riskRewardRatio??1.5):event.price+sign*strategy.exit.takeProfitPips*pipSize;
  const result={...event,stopLoss:stop,takeProfit:take};
  // Start after the entry candle: OHLC alone cannot order intrabar trigger vs exit.
  for(let i=event.index+1;i<bars.length;i++){
    const sl=event.side==="buy"?bars[i].low<=stop:bars[i].high>=stop,tp=event.side==="buy"?bars[i].high>=take:bars[i].low<=take;
    if(sl||tp)return {...result,exitIndex:i,exitPrice:sl&&tp?undefined:sl?stop:take,exitReason:sl&&tp?"ambiguous":sl?"SL":"TP"};
  }
  return result;
}
