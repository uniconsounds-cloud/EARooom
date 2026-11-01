"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function AuthNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const db = getSupabase();
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checking) return <div className="header-actions" aria-live="polite"><span className="auth-nav-loading">กำลังตรวจสอบ…</span></div>;
  return <div className="header-actions">
    {email ? <Link href="/dashboard" className="sign-in-link">Dashboard</Link> : <Link href="/account" className="sign-in-link">เข้าสู่ระบบ</Link>}
    <Link href="/build" className="header-cta">{email ? "เริ่มสร้าง" : "เริ่มสร้าง"}<span aria-hidden="true">↗</span></Link>
  </div>;
}
