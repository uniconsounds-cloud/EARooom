"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import "../account/account.css";
import "./dashboard.css";

type StrategyItem = { id: string; name: string; is_public: boolean; updated_at: string };

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);
  const [items, setItems] = useState<StrategyItem[]>([]);
  const [status, setStatus] = useState("กำลังโหลดข้อมูลบัญชี…");

  useEffect(() => {
    let active = true;
    async function load() {
      const db = getSupabase();
      if (!db) { if (active) setStatus("ยังไม่ได้เชื่อม Supabase"); return; }
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user) { setStatus("กรุณาเข้าสู่ระบบเพื่อดู Dashboard"); return; }
      setEmail(user.email ?? null);
      const { data, error } = await db.from("strategies").select("id,name,is_public,updated_at").order("updated_at", { ascending: false });
      if (!active) return;
      if (error) { setStatus("โหลดข้อมูล Strategy ไม่สำเร็จ กรุณาลองใหม่"); return; }
      setItems(data ?? []);
      setStatus("");
    }
    void load();
    return () => { active = false; };
  }, []);

  const shared = items.filter(item => item.is_public).length;
  const privateCount = items.length - shared;
  return <main className="account-page dashboard-page"><div className="dashboard-shell">
    <header className="dashboard-header"><Link className="account-logo" href="/">✳ EASpaze<span>.</span></Link><Link href="/">กลับหน้าแรก →</Link></header>
    <section className="dashboard-intro"><span className="account-kicker">YOUR PERSONAL SPACE</span><h1>สวัสดี{email ? `, ${email.split("@")[0]}` : "ครับ"}</h1><p>นี่คือภาพรวมของ Strategy และกิจกรรมในบัญชี EASpaze ของคุณ</p></section>
    {status && <div className="account-info" role="status">{status}{status.includes("เข้าสู่ระบบ") && <Link href="/account"> ไปเข้าสู่ระบบ →</Link>}</div>}
    {!status && <>
      <section className="dashboard-stats" aria-label="สรุป Strategy ของฉัน">
        <article><span>STRATEGIES ทั้งหมด</span><strong>{items.length}</strong><p>รายการในบัญชีของคุณ</p></article>
        <article><span>แชร์ใน EXPLORE</span><strong>{shared}</strong><p>เปิดให้ชุมชนดูและคัดลอกได้</p></article>
        <article><span>ส่วนตัว</span><strong>{privateCount}</strong><p>เห็นได้เฉพาะคุณ</p></article>
      </section>
      <section className="dashboard-section"><div className="dashboard-section-heading"><div><span className="account-kicker">RECENT ACTIVITY</span><h2>Strategy ล่าสุด</h2></div><Link href="/strategies">ดูทั้งหมด →</Link></div>
        {items.length ? <div className="dashboard-recent">{items.slice(0, 4).map(item => <article key={item.id}><div><strong>{item.name}</strong><p>แก้ไขล่าสุด {new Date(item.updated_at).toLocaleDateString("th-TH")} · {item.is_public ? "แชร์ใน Explore" : "ส่วนตัว"}</p></div><Link href={`/build?id=${encodeURIComponent(item.id)}`}>แก้ไข →</Link></article>)}</div> : <div className="dashboard-empty"><p>ยังไม่มี Strategy ในบัญชี เริ่มจากไอเดียแรกของคุณได้เลย</p><Link className="dashboard-primary" href="/build">สร้าง Strategy แรก →</Link></div>}
      </section>
      <section className="dashboard-shortcuts"><Link href="/build"><strong>✳ สร้าง Strategy</strong><span>เปลี่ยนไอเดียเป็นกติกาทีละขั้น →</span></Link><Link href="/explore"><strong>⌕ สำรวจกลยุทธ์</strong><span>ดูสิ่งที่ชุมชนเลือกแชร์ →</span></Link><article><strong>◷ Backtest</strong><span>การเชื่อมต่อผลทดสอบกำลังพัฒนา</span></article></section>
    </>}
  </div></main>;
}
