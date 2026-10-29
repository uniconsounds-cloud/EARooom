"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import "./account.css";

export default function Account() {
  const [mode,setMode] = useState<"signin" | "signup">("signin");
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [user,setUser] = useState<string | null>(null); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
  const configured = !!getSupabase();
  useEffect(() => { const supabase = getSupabase(); if (!supabase) return; supabase.auth.getUser().then(({data})=>setUser(data.user?.email ?? null)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user.email ?? null)); return ()=>subscription.unsubscribe(); },[]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const supabase=getSupabase(); if(!supabase) return; setBusy(true); setMessage("");
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({email,password}) : await supabase.auth.signUp({email,password,options:{emailRedirectTo: `${window.location.origin}/account`}});
    setBusy(false);
    if(result.error) { setMessage("ไม่สามารถดำเนินการได้ โปรดตรวจสอบอีเมล รหัสผ่าน และการตั้งค่าบัญชี แล้วลองอีกครั้ง"); return; }
    setPassword(""); setMessage(mode === "signup" && !result.data.session ? "หากลงทะเบียนสำเร็จ โปรดตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ" : "เข้าสู่ระบบแล้ว คุณสามารถเปิด My Strategies ได้");
  }
  async function signOut() { const supabase=getSupabase(); if(!supabase) return; const {error}=await supabase.auth.signOut(); if(error) setMessage("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง"); else {setUser(null);setMessage("ออกจากระบบแล้ว");} }
  return <main className="account-page"><div className="account-shell"><Link href="/" className="account-logo">✳ EASpaze<span>.</span></Link><div className="account-card"><span className="account-kicker">YOUR SPACE TO CREATE</span><h1>{user ? "ยินดีต้อนรับกลับ" : mode === "signin" ? "เข้าสู่ EASpaze" : "สร้างบัญชี EASpaze"}</h1><p>เก็บ Strategy ของคุณไว้ในพื้นที่ส่วนตัว และกลับมาแก้ไขได้ภายหลัง</p>{!configured ? <div className="account-info">ระบบบัญชียังไม่ได้เชื่อม Supabase ในสภาพแวดล้อมนี้ คุณยังสามารถสร้าง Draft ในเบราว์เซอร์ได้</div> : user ? <><div className="account-info">เข้าสู่ระบบด้วย {user}</div><Link className="account-primary" href="/strategies">ไปที่ My Strategies →</Link><button className="account-link" type="button" onClick={signOut}>ออกจากระบบ</button></> : <><div className="account-tabs"><button type="button" aria-pressed={mode === "signin"} onClick={()=>{setMode("signin");setMessage("");}}>เข้าสู่ระบบ</button><button type="button" aria-pressed={mode === "signup"} onClick={()=>{setMode("signup");setMessage("");}}>สร้างบัญชี</button></div><form onSubmit={submit}><label>อีเมล<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><label>รหัสผ่าน<input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} /></label><button className="account-primary" type="submit" disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}</button></form></>}{message && <p className="account-message" role="status">{message}</p>}<Link href="/build" className="account-bottom">← กลับไปสร้าง Strategy</Link></div></div></main>;
}
