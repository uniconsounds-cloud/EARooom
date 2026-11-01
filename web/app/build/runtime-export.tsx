"use client";
import type { Strategy } from "@/lib/strategy/model";
import { fingerprint, runtimeConfig, runtimeErrors } from "@/lib/strategy/runtime";
export default function RuntimeExport({strategy,strategyId,isPublic}:{strategy:Strategy;strategyId:string|null;isPublic:boolean}){
  const errors=runtimeErrors(strategy);
  function download(runtime:boolean){const text=runtime?runtimeConfig(strategy):JSON.stringify({...strategy,contractVersion:"1.0.0"},null,2);const url=URL.createObjectURL(new Blob([text],{type:runtime?"text/plain;charset=utf-8":"application/json"}));const a=document.createElement("a");a.href=url;a.download=runtime?"easpaze.cfg":"strategy.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <details className="runtime-export"><summary>EA Engine · 0.1.0 <small>Config {fingerprint(strategy)}</small></summary><p>Simple · EMA / Stoch / RSI / MA cross / Price cross · ตรวจรุ่นและค่าก่อนรัน</p><button type="button" onClick={()=>download(false)}>ดาวน์โหลด Strategy JSON</button><button type="button" disabled={errors.length>0} onClick={()=>download(true)}>ดาวน์โหลด Config สำหรับ MT5</button>{errors.map((e,i)=><p className="runtime-error" key={i}>{e}</p>)}{!errors.length&&strategyId&&isPublic&&<label>URL สำหรับ Sync EA (Strategy สาธารณะ)<input readOnly value={typeof window!=="undefined"?`${window.location.origin}/api/engine/${strategyId}`:""} onFocus={e=>e.currentTarget.select()}/></label>}<p>ติดตั้ง EA รุ่นแรกแล้ววาง easpaze.cfg ใน Common Files · คู่มืออยู่ใน repo: ea-engine/engine-v1/README.md</p></details>;
}
