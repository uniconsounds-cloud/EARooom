"use client";
import { useState } from "react";
import type { Strategy } from "@/lib/strategy/model";
import { fingerprint, runtimeConfig, runtimeErrors } from "@/lib/strategy/runtime";

export default function RuntimeExport({ strategy, strategyId, isPublic, savedFingerprint, savedPublic }: { strategy: Strategy; strategyId: string | null; isPublic: boolean; savedFingerprint: string | null; savedPublic: boolean }) {
  const [copyStatus, setCopyStatus] = useState("");
  const errors = runtimeErrors(strategy);
  const revision = fingerprint(strategy);
  const savedMatches = !!strategyId && savedFingerprint === revision && savedPublic === isPublic;
  const syncUrl = typeof window !== "undefined" && savedMatches && savedPublic ? `${window.location.origin}/api/engine/${strategyId}` : "";
  function download(runtime: boolean) {
    const content = runtime ? runtimeConfig(strategy) : JSON.stringify({ ...strategy, contractVersion: "1.0.0" }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: runtime ? "text/plain;charset=utf-8" : "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = runtime ? "easpaze.cfg" : "strategy.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(syncUrl); setCopyStatus("คัดลอก URL แล้ว"); }
    catch { setCopyStatus("กดค้างหรือเลือกข้อความในช่อง URL เพื่อคัดลอก"); }
  }
  return <section className="runtime-export" aria-label="เตรียม Strategy สำหรับ MT5">
    <h3>นำ Strategy ไปใช้กับ MT5</h3>
    <p>EA รุ่น 0.1 · Simple ไม้เดียว · ทดลองบน Demo หรือ Strategy Tester</p>
    <ol>
      <li><strong>ตรวจค่า Strategy</strong><br/>{errors.length ? "ยังมีค่าที่ต้องแก้ก่อนส่งให้ EA" : "กติกาเข้ากันได้กับ EA รุ่นนี้"}</li>
      <li><strong>บันทึกลงบัญชี</strong><br/>{savedMatches ? "บันทึกค่าปัจจุบันแล้ว" : "กดบันทึก Draft ลงบัญชีเพื่อเก็บค่าปัจจุบัน"}</li>
      <li><strong>ดาวน์โหลด Config</strong><br/>เลือกไฟล์สำหรับ Strategy ส่วนตัวหรือสาธารณะ แล้ววางใน MT5 Common Files</li>
      <li><strong>เปิด EA บนกราฟ Demo</strong><br/>เลือก Symbol และ Timeframe ให้ตรง แล้วตรวจว่า EA แสดง SYNC OK และ MONITOR</li>
    </ol>
    {errors.map((error, i) => <p className="runtime-error" key={i}>{error}</p>)}
    <button type="button" disabled={errors.length > 0} onClick={() => download(true)}>ดาวน์โหลด Config สำหรับ MT5</button>
    <details><summary>ตัวเลือกเพิ่มเติมและขั้นตอนติดตั้ง</summary>
      <p>1. ติดตั้ง EA Engine 0.1.0 ใน MT5 และ Refresh ใน Navigator</p>
      <p>2. วาง <strong>easpaze.cfg</strong> ในโฟลเดอร์ Terminal/Common/Files แล้วเปิด EA บน chart ของบัญชี Demo</p>
      <p>3. เริ่มด้วย <strong>InpEnableDemoOrders = false</strong> เพื่อตรวจสัญญาณ หากต้องการทดลองส่งออเดอร์ใน Demo ให้ปรับเป็น true หลังตรวจค่าครบ</p>
      <p>4. หากแก้ Strategy ส่วนตัว ให้ดาวน์โหลด Config ใหม่และแทนที่ไฟล์เดิม EA จะอ่านค่าใหม่เป็นระยะ</p>
      <a href="https://github.com/uniconsounds-cloud/EARooom/blob/feat/landing-page/ea-engine/engine-v1/README.md" target="_blank" rel="noreferrer">อ่านคู่มือ MT5 พร้อมไฟล์ EA ↗</a>
      <button type="button" onClick={() => download(false)}>ดาวน์โหลด Strategy JSON</button>
      <p>หมายเลข Config สำหรับเทียบกับ EA: <strong>{revision}</strong></p>
      {syncUrl ? <><label>URL สำหรับ Sync Strategy สาธารณะ<input readOnly value={syncUrl} onFocus={e => e.currentTarget.select()}/></label><button type="button" onClick={copy}>คัดลอก URL</button><p role="status">{copyStatus}</p><p>EA ต้องเข้าถึง URL ได้ และตั้ง Allow WebRequest ใน MT5 · การเปลี่ยนค่าขณะมี Position จะรอจน Position ปิด</p></> : <p>{isPublic ? "บันทึก Strategy สาธารณะก่อน จึงจะแสดง URL ที่ตรงกับค่าล่าสุด" : "Strategy ส่วนตัวใช้ Config file · URL Sync ใช้ได้เมื่อบันทึกและแชร์สาธารณะเท่านั้น"}</p>}
    </details>
    <p>เว็บยังไม่ได้รับสถานะจาก EA ให้ตรวจ SYNC และ revision บน MT5 · EA รุ่นนี้ยังไม่รองรับ Recovery หรือบัญชีเงินจริง</p>
  </section>;
}
