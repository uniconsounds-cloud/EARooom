"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import "../account/account.css";

type Item = { id: string; name: string; updated_at: string; is_public: boolean };
export default function Strategies() {
  const [items,setItems]=useState<Item[]>([]); const [status,setStatus]=useState("กำลังโหลด Strategy…");
  useEffect(()=>{ let active=true; async function load(){const db=getSupabase(); if(!db){if(active)setStatus("ระบบบัญชียังไม่ได้เชื่อม Supabase ในสภาพแวดล้อมนี้");return;} const {data:{user},error:authError}=await db.auth.getUser(); if(!user || authError){if(active)setStatus("กรุณาเข้าสู่ระบบเพื่อดู Strategy ของคุณ");return;} const {data,error}=await db.from("strategies").select("id,name,updated_at,is_public").order("updated_at",{ascending:false}); if(!active)return; if(error){setStatus("ไม่สามารถโหลด Strategy ได้ กรุณาลองใหม่อีกครั้ง");return;} setItems(data ?? []); setStatus(data?.length ? "" : "ยังไม่มี Strategy ที่บันทึกในบัญชีนี้");} void load(); return ()=>{active=false;};},[]);
  return <main className="account-page"><div className="account-shell"><Link className="account-logo" href="/">✳ EASpaze<span>.</span></Link><div className="account-card"><span className="account-kicker">YOUR STRATEGY SPACE</span><h1>My Strategies</h1><p>Strategy ส่วนตัวที่บันทึกไว้ในบัญชีของคุณ</p>{status && <div className="account-info" role="status">{status}</div>}<div className="strategy-items">{items.map(item=><article className="strategy-item" key={item.id}><div><h2>{item.name}</h2><p>แก้ไขล่าสุด {new Date(item.updated_at).toLocaleDateString("th-TH")} · {item.is_public ? "แชร์ใน Explore" : "ส่วนตัว"}</p></div><Link href={`/build?id=${encodeURIComponent(item.id)}`}>เปิดแก้ไข →</Link></article>)}</div><Link className="account-primary" href="/build">สร้าง Strategy ใหม่ →</Link><Link className="account-bottom" href="/explore">ไปที่ Explore</Link><br/><Link className="account-bottom" href="/account">จัดการบัญชี</Link></div></div></main>;
}
