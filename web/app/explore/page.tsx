"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import "../account/account.css";
import "./explore.css";

type PublicStrategy = { id: string; name: string; config: { symbol?: string; timeframe?: string; entry?: { type?: string } }; updated_at: string };
const entryNames: Record<string, string> = { ma_cross: "เส้นค่าเฉลี่ยตัดกัน", price_ma: "ราคาตัดเส้นค่าเฉลี่ย", rsi_recovery: "RSI กลับผ่านระดับ", gold_stoch_pullback: "Gold · EMA + Stochastic Pullback" };

export default function Explore() {
  const [items, setItems] = useState<PublicStrategy[]>([]);
  const [status, setStatus] = useState("กำลังโหลด Strategy ที่แชร์แล้ว…");
  useEffect(() => {
    let active = true;
    async function load() {
      const db = getSupabase();
      if (!db) { if (active) setStatus("หน้านี้ยังไม่พร้อมแสดงผล เพราะยังไม่ได้เชื่อม Supabase"); return; }
      const { data, error } = await db.from("strategies").select("id,name,config,updated_at").eq("is_public", true).order("updated_at", { ascending: false });
      if (!active) return;
      if (error) { setStatus("โหลดรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"); return; }
      setItems(data ?? []);
      setStatus(data?.length ? "" : "ยังไม่มี Strategy ที่แชร์ใน Explore · คุณเริ่มแชร์เป็นคนแรกได้เลย");
    }
    void load();
    return () => { active = false; };
  }, []);

  return <main className="account-page explore-page"><div className="explore-shell">
    <Link className="account-logo" href="/">✳ EASpaze<span>.</span></Link>
    <div className="explore-heading"><div><span className="account-kicker">COMMUNITY STRATEGIES</span><h1>Explore Strategies</h1><p>ค้นหาไอเดียจากชุมชน แล้วคัดลอกไปปรับเป็น Strategy ของคุณ</p></div><Link className="explore-build" href="/build">สร้าง Strategy →</Link></div>
    {status && <div className="account-info" role="status">{status}</div>}
    <div className="explore-grid">{items.map(item => <article className="explore-card" key={item.id}>
      <div className="explore-card-top"><span>✳ EASpaze</span><span>แชร์โดย Creator</span></div><h2>{item.name}</h2>
      <p>{entryNames[item.config?.entry?.type ?? ""] ?? "Strategy จากชุมชน"}</p>
      <div className="explore-meta"><span>{item.config?.symbol ?? "—"}</span><span>{item.config?.timeframe ?? "—"}</span></div>
      <div className="explore-disclaimer">ยังไม่มีผล Backtest ที่ยืนยันบนแพลตฟอร์ม</div>
      <Link className="explore-copy" href={`/build?copy=${encodeURIComponent(item.id)}`}>คัดลอกเป็น Strategy ของฉัน →</Link>
    </article>)}</div>
    <Link className="account-bottom" href="/strategies">← กลับไป My Strategies</Link>
  </div></main>;
}
