"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import "../account/account.css";

type Item = { id: string; name: string; updated_at: string; is_public: boolean };

export default function Strategies() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("กำลังโหลด Strategy…");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const db = getSupabase();
      if (!db) { if (active) setStatus("ระบบบัญชียังไม่ได้เชื่อม Supabase ในสภาพแวดล้อมนี้"); return; }
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (!user || authError) { if (active) setStatus("กรุณาเข้าสู่ระบบเพื่อดู Strategy ของคุณ"); return; }
      const { data, error } = await db.from("strategies").select("id,name,updated_at,is_public").order("updated_at", { ascending: false });
      if (!active) return;
      if (error) { setStatus("ไม่สามารถโหลด Strategy ได้ กรุณาลองใหม่อีกครั้ง"); return; }
      setItems(data ?? []);
      setStatus(data?.length ? "" : "ยังไม่มี Strategy ที่บันทึกในบัญชีนี้");
    }
    void load();
    return () => { active = false; };
  }, []);

  async function deleteStrategy(item: Item) {
    const sharedNote = item.is_public ? " Strategy นี้แชร์อยู่ใน Explore และจะถูกนำออกจากชุมชนด้วย" : "";
    if (!window.confirm(`ต้องการลบ “${item.name}” ใช่ไหม?${sharedNote} การลบนี้ย้อนกลับไม่ได้`)) return;
    const db = getSupabase();
    if (!db) { setStatus("ยังไม่ได้เชื่อม Supabase จึงลบ Strategy ไม่ได้"); return; }
    setDeletingId(item.id);
    try {
      const { error } = await db.from("strategies").delete().eq("id", item.id);
      if (error) { setStatus("ลบ Strategy ไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
      const remaining = items.filter(current => current.id !== item.id);
      setItems(remaining);
      setStatus(remaining.length ? "" : "ลบแล้ว · ยังไม่มี Strategy ที่บันทึกในบัญชีนี้");
    } catch { setStatus("ลบ Strategy ไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setDeletingId(null); }
  }

  return <main className="account-page"><div className="account-shell"><Link className="account-logo" href="/">✳ EASpaze<span>.</span></Link><div className="account-card"><span className="account-kicker">YOUR STRATEGY SPACE</span><h1>My Strategies</h1><p>Strategy ส่วนตัวที่บันทึกไว้ในบัญชีของคุณ</p>{status && <div className="account-info" role="status">{status}</div>}<div className="strategy-items">{items.map(item=><article className="strategy-item" key={item.id}><div><h2>{item.name}</h2><p>แก้ไขล่าสุด {new Date(item.updated_at).toLocaleDateString("th-TH")} · {item.is_public ? "แชร์ใน Explore" : "ส่วนตัว"}</p></div><div className="strategy-item-actions"><Link href={`/build?id=${encodeURIComponent(item.id)}`}>เปิดแก้ไข →</Link><button type="button" disabled={deletingId === item.id} onClick={() => void deleteStrategy(item)}>{deletingId === item.id ? "กำลังลบ…" : "ลบ Strategy"}</button></div></article>)}</div><Link className="account-primary" href="/build">สร้าง Strategy ใหม่ →</Link><Link className="account-bottom" href="/explore">ไปที่ Explore</Link><br/><Link className="account-bottom" href="/account">จัดการบัญชี</Link></div></div></main>;
}
