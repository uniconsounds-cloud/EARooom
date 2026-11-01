import type { Strategy, EntryModule } from "./model";
import { RULES, TF_SECONDS } from "./evaluator";
export const TRIGGERS=["immediate","next_bar_open","delay_seconds","price_move","break_signal_candle","pullback_to_ema","manual","candle_reversal"];
function one(value:unknown,allowed:readonly string[]){return typeof value==="string"&&allowed.includes(value);}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value);}
// Shape checks allow incomplete numeric drafts, but never malformed nested data.
export function isEditableStrategy(value:unknown):value is Strategy {
  if(!record(value)||value.schemaVersion!==1||typeof value.name!=="string"||typeof value.symbol!=="string"||typeof value.timeframe!=="string"||typeof value.direction!=="string")return false;
  if(value.contractVersion!==undefined&&value.contractVersion!=="1.0.0")return false;
  if(!Object.hasOwn(TF_SECONDS,value.timeframe)||!["buy","sell","both"].includes(value.direction))return false;
  if(!record(value.entry)||!record(value.manage)||!record(value.exit)||!record(value.protection))return false;
  const {entry,manage,exit,protection}=value;
  const numeric=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
  const optional=(o:Record<string,unknown>,keys:string[])=>keys.every(k=>o[k]===undefined||numeric(o[k]));
  if(!one(entry.type,["ma_cross","price_ma","rsi_recovery","gold_stoch_pullback"]))return false;
  if(!["fastPeriod","slowPeriod","maPeriod","rsiPeriod","rsiLow","rsiHigh"].every(k=>numeric(entry[k]))||!numeric(manage.lotSize)||!numeric(manage.maxPositions)||!numeric(exit.stopLossPips)||!numeric(exit.takeProfitPips)||!numeric(protection.maxSpreadPoints))return false;
  for(const name of ["signalGroup","firstEntryGroup"]){const g=entry[name];if(g===undefined)continue;if(!record(g)||!one(g.logic,["all","any"])||!Array.isArray(g.conditions)||g.conditions.length>100)return false;for(const m of g.conditions)if(!record(m)||!(typeof m.kind==="string"&&Object.hasOwn(RULES,m.kind))||(m.rule!==undefined&&typeof m.rule!=="string")||!optional(m,["period","fastPeriod","slowPeriod","signalPeriod","level","upperLevel"]))return false;}
  const trigger=(t:unknown)=>t===undefined||(record(t)&&one(t.kind,TRIGGERS)&&optional(t,["delaySeconds","priceMovePoints","emaPeriod","bufferPoints","maxWaitBars"]));
  if(!trigger(entry.trigger)||!optional(entry,["stochasticKPeriod","stochasticDPeriod","stochasticSlowing","stochasticOversold","stochasticOverbought","emaFilterPeriod"])||!optional(exit,["swingLookbackBars","swingBufferPoints","riskRewardRatio","basketStopLoss","basketTakeProfit"]))return false;
  const conditions=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(c=>record(c)&&one(c.kind,["candle_reversal","trend_filter","range_reentry","atr_gate","rsi_recovery","manual_confirm"])&&optional(c,["period","level"]));
  if(entry.conditions!==undefined&&!conditions(entry.conditions))return false;
  if(manage.recovery!==undefined){const r=manage.recovery;if(!record(r)||!numeric(r.maxAdds)||!Number.isInteger(r.maxAdds)||r.maxAdds<0||r.maxAdds>3||!numeric(r.spacingPoints)||!numeric(r.lotMultiplier)||!optional(r,["cooldownBars","atrPeriod","atrMultiplier","maxWaitBars"]))return false;if(r.preset!==undefined&&!one(r.preset,["distance","candle","trend","range","atr","manual","custom"]))return false;if(r.orderRules!==undefined&&(!Array.isArray(r.orderRules)||r.orderRules.length>3||!r.orderRules.every(rule=>record(rule)&&one(rule.logic,["all","any"])&&conditions(rule.conditions)&&trigger(rule.trigger))))return false;}
  if(exit.closeRules!==undefined&&(!Array.isArray(exit.closeRules)||exit.closeRules.length>50||!exit.closeRules.every(r=>record(r)&&one(r.kind,["average_target","trailing_average","partial_close","time_limit","signal_exit","manual_close"])&&optional(r,["value","secondaryValue"]))))return false;
  return true;
}
export function validateStrategy(value:unknown,allowIncomplete=false):string[] {
  const errors:string[]=[];
  if(!value||typeof value!=="object")return ["Strategy ต้องเป็น object"];
  if(!isEditableStrategy(value))return ["โครงสร้างข้อมูล Strategy ไม่ถูกต้อง กรุณาตรวจ Entry/Manage/Exit"];
  const s=value;
  if(s.schemaVersion!==1)return ["ไม่รองรับ schemaVersion นี้"];
  if(s.contractVersion&&s.contractVersion!=="1.0.0")errors.push("ไม่รองรับ contractVersion นี้");
  if(typeof s.name!=="string"||!s.name.trim()||s.name.length>80)errors.push("ชื่อ Strategy ต้องมี 1–80 ตัวอักษร");
  if(typeof s.symbol!=="string"||!s.symbol.trim()||s.symbol.length>20)errors.push("ตรวจสัญลักษณ์สินทรัพย์");
  if(!Object.hasOwn(TF_SECONDS,s.timeframe))errors.push("ไม่รองรับ Timeframe นี้");
  if(!["buy","sell","both"].includes(s.direction))errors.push("ตรวจทิศทาง Buy/Sell");
  if(!s.entry||!s.manage||!s.exit||!s.protection)return [...errors,"ข้อมูล Entry/Manage/Exit/Protection ไม่ครบ"];
  if(!["ma_cross","price_ma","rsi_recovery","gold_stoch_pullback"].includes(s.entry.type))errors.push("ไม่รองรับชนิด Entry รุ่นเก่า");
  if(s.manage.mode!==undefined&&!["single","recovery"].includes(s.manage.mode))errors.push("เลือก Simple หรือ Recovery");
  if(!Number.isInteger(s.manage.maxPositions)||s.manage.maxPositions<1||s.manage.maxPositions>1000)errors.push("ตรวจจำนวน Position สูงสุด");
  if(s.manage.mode==="single"&&s.manage.maxPositions!==1)errors.push("Simple ต้องมีไม่เกิน 1 Position");
  const number=(n:unknown,min:number,max:number,label:string,integer=false)=>{if(typeof n!=="number"||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))errors.push(`ตรวจค่า ${label} (${min}–${max})`);};
  for(const group of [s.entry.signalGroup,s.entry.firstEntryGroup])if(group){
    if(!["all","any"].includes(group.logic)||!Array.isArray(group.conditions)||group.conditions.length>12){errors.push("กลุ่มต้องใช้ ALL/ANY และไม่เกิน 12 โมดูล");continue;}
    for(const m of group.conditions){
      if(!m||!Object.hasOwn(RULES,m.kind)){errors.push("ไม่รองรับ Indicator นี้");continue;}
      if(m.rule&&!RULES[m.kind].includes(m.rule))errors.push(`ไม่รองรับกติกา ${m.kind}/${m.rule}`);
      if(allowIncomplete)continue;
      for(const key of ["period","fastPeriod","slowPeriod","signalPeriod"] as const)if(m[key]!==undefined)number(m[key],1,2000,key,true);
      if(m.kind==="ma_cross"&&(m.fastPeriod??20)>=(m.slowPeriod??50))errors.push("MA เร็วต้องมี Period น้อยกว่า MA ช้า");
      if(m.averageType&&!["EMA","SMA"].includes(m.averageType))errors.push("เลือก EMA/SMA");
      if(m.target&&!["moving_average","price_level"].includes(m.target))errors.push("ตรวจชนิด Price cross");
      if(m.kind==="rsi"||m.kind==="stochastic"){
        const low=m.level??(m.kind==="rsi"?30:20),high=m.upperLevel??(m.kind==="rsi"?70:80);
        number(low,0,100,"ระดับต่ำ");number(high,0,100,"ระดับสูง");if(low>=high)errors.push("ระดับต่ำต้องน้อยกว่าระดับสูง");
      }
      if(m.kind==="price_cross"&&m.target==="price_level")number(m.level,.000001,1e9,"ระดับราคา");
    }
  }
  const t=s.entry.trigger;if(t){
    if(!TRIGGERS.includes(t.kind))errors.push("ไม่รองรับ Trigger นี้");
    if(t.kind==="delay_seconds")number(t.delaySeconds??10,1,86400,"หน่วงเวลา",true);
    if(t.kind==="price_move")number(t.priceMovePoints??10,.01,1e7,"ระยะขยับราคา");
    if(t.moveDirection&&!["favorable","adverse"].includes(t.moveDirection))errors.push("ตรวจทิศทางรอราคา");
    if(t.maxWaitBars!==undefined)number(t.maxWaitBars,1,1000,"อายุสัญญาณ",true);
    if(t.emaPeriod!==undefined)number(t.emaPeriod,1,2000,"EMA Trigger",true);
    if(t.bufferPoints!==undefined)number(t.bufferPoints,0,1e7,"Buffer");
  }
  number(s.manage.lotSize,.001,1000,"Lot");number(s.protection.maxSpreadPoints,.01,1e7,"Spread");
  number(s.exit.stopLossPips,.01,1e7,"SL");number(s.exit.takeProfitPips,.01,1e7,"TP");
  if(s.exit.stopMode&&!["fixed_pips","swing"].includes(s.exit.stopMode))errors.push("ตรวจวิธี SL");
  if(s.exit.stopMode==="swing"){number(s.exit.swingLookbackBars??10,1,2000,"Swing lookback",true);number(s.exit.swingBufferPoints??0,0,1e7,"Swing buffer");number(s.exit.riskRewardRatio??1.5,.01,100,"RR");}
  return errors;
}
export function moduleLabel(m:EntryModule) {return m.kind==="ema"?`EMA ${m.period??400} · ${m.rule??"with_direction"}`:m.kind==="ma_cross"?`${m.averageType??"SMA"} ${m.fastPeriod??20}/${m.slowPeriod??50} · ${m.rule??"cross_for_direction"}`:`${m.kind} ${m.period??14} · ${m.rule??"cross_for_direction"}`;}
