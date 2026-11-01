import { ENGINE_VERSION, RULE_VERSION, type Strategy } from "./model";
import { historyLength } from "./evaluator";
import { validateStrategy } from "./validation";
export function runtimeErrors(strategy:Strategy) {
  const errors=validateStrategy(strategy);
  if(strategy.entry?.signalGroup?.conditions.some(m=>m.kind==="stochastic"&&m.rule==="zone_then_cross"))errors.push("EA 0.1 ยังไม่รองรับ Stochastic สองจังหวะ · กรุณารอ EA รุ่นใหม่ก่อนส่งไปรัน");
  if(!strategy.entry?.signalGroup?.conditions.length)errors.push("เพิ่ม Setup อย่างน้อย 1 โมดูล");
  if(strategy.manage?.mode==="recovery"||(strategy.manage?.mode===undefined&&strategy.manage?.maxPositions>1))errors.push("EA 0.1 รองรับ Simple เท่านั้น · Recovery ยังส่งไปรันไม่ได้");
  if(strategy.entry?.firstEntryGroup?.conditions.length)errors.push("จัดเงื่อนไขเข้าไม้เดิมเข้ากลุ่ม Setup ก่อนส่งให้ EA");
  if(strategy.entry?.conditions?.length)errors.push("มีเงื่อนไขรุ่นเก่าที่ยังไม่ได้ย้ายเข้ากลุ่ม Setup");
  if(strategy.exit?.closeRules?.length)errors.push("EA 0.1 ยังไม่รองรับวิธี Exit เสริม");
  if(strategy.entry?.trigger?.kind==="candle_reversal")errors.push("ย้าย Candle reversal ไป Setup ก่อนใช้ EA รุ่นแรก");
  if(!/^[A-Za-z0-9._#-]{1,20}$/.test(strategy.symbol))errors.push("Symbol สำหรับ EA ใช้ตัวอักษร ตัวเลข . _ # - เท่านั้น");
  return errors;
}
export function fingerprint(strategy:Strategy) {
  let h=2166136261;for(const ch of JSON.stringify(strategy)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,"0");
}
// The adapter only serializes canonical rules. It does not invent trading logic.
export function runtimeConfig(strategy:Strategy) {
  const errors=runtimeErrors(strategy);if(errors.length)throw new Error(errors.join("\n"));
  const t=strategy.entry.trigger??{kind:"next_bar_open"};
  const values:Record<string,string|number>={format:"easpaze-runtime",contract:RULE_VERSION,engine:ENGINE_VERSION,revision:fingerprint(strategy),symbol:strategy.symbol,timeframe:strategy.timeframe,direction:strategy.direction,logic:strategy.entry.signalGroup!.logic,history:historyLength(strategy),lot:strategy.manage.lotSize,maxSpread:strategy.protection.maxSpreadPoints,trigger:t.kind,delay:t.delaySeconds??10,move:t.priceMovePoints??10,moveDirection:t.moveDirection??"favorable",buffer:t.bufferPoints??0,triggerEma:t.emaPeriod??50,wait:t.maxWaitBars??3,stopMode:strategy.exit.stopMode??"fixed_pips",sl:strategy.exit.stopLossPips,tp:strategy.exit.takeProfitPips,lookback:strategy.exit.swingLookbackBars??10,swingBuffer:strategy.exit.swingBufferPoints??0,rr:strategy.exit.riskRewardRatio??1.5,count:strategy.entry.signalGroup!.conditions.length};
  strategy.entry.signalGroup!.conditions.forEach((m,i)=>{
    const defaultRule=({ema:"with_direction",stochastic:"cross_for_direction",rsi:"recover_for_direction",ma_cross:"cross_for_direction",price_cross:"cross_for_direction"})[m.kind];
    const attrs={kind:m.kind,rule:m.rule??defaultRule,period:m.period??(m.kind==="ema"?400:m.kind==="stochastic"?15:m.kind==="price_cross"?50:14),fast:m.fastPeriod??20,slow:m.slowPeriod??(m.kind==="stochastic"?9:50),signal:m.signalPeriod??2,low:m.level??(m.kind==="stochastic"?20:30),high:m.upperLevel??(m.kind==="stochastic"?80:70),average:m.averageType??(m.kind==="ma_cross"?"SMA":"EMA"),target:m.target??"moving_average"};
    for(const [key,value]of Object.entries(attrs))values[`m${i}.${key}`]=value;
  });
  return Object.entries(values).map(([k,v])=>`${k}=${v}`).join("\n")+"\n";
}
