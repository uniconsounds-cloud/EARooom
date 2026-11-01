# เปิด Describe to AI / คู่มือไทย + English

Manual Builder ใช้ได้โดยไม่ต้องตั้งค่า AI

## ตั้งค่า Supabase

1. เปิดโปรเจกต์ **EA Spaze → SQL Editor → New query**
2. วาง SQL จาก `supabase/migrations/20261031000000_strategy_ai_quota.sql` แล้วกด Run
3. Migration นี้สร้างโควตา AI แบบ atomic ต่อ user: 20 คำขอต่อวัน UTC และไม่เปิดสิทธิ์แก้ quota โดยตรง

## ตั้งค่า Vercel

เปิด **Project → Settings → Environment Variables** เพิ่ม:

- `OPENAI_API_KEY`: Secret ของ OpenAI API (server only; อย่าใช้ NEXT_PUBLIC_ และอย่าส่งคีย์ในแชท)
- `OPENAI_STRATEGY_MODEL`: optional; default `gpt-5-mini` ต้องรองรับ Responses API Structured Outputs

เลือก Environment ที่จะใช้ (Preview/Production) แล้ว Redeploy หลังแก้ค่า

## ลองใช้งาน

1. เข้าสู่ระบบบัญชี EASpaze
2. เปิด Builder → **อธิบาย Strategy ให้ AI**
3. อธิบายกติกาพร้อมตัวเลขและหน่วย เช่น Buy XAUUSD M5 ราคาปิดเหนือ EMA 200 เข้าแท่งถัดไป Lot 0.01 SL/TP ระยะคงที่ 30/60 pips
4. ถ้า AI ถามเพิ่ม ให้เพิ่มข้อมูลในคำอธิบาย แล้วตีความอีกครั้ง
5. ตรวจคำอธิบาย, Strategy JSON และรายการค่าที่ใช้จากฟอร์มเดิม
6. ติ๊กยืนยัน → **นำมาแก้ไขต่อใน Builder** → ตรวจกราฟและ Save ลงบัญชีเอง

AI ตีความคำอธิบาย ไม่เสนอค่าทำกำไร ถ้าขอเงื่อนไขที่ schema ยังไม่รองรับ จะแสดงรายการนั้นและไม่เปิดปุ่มนำมาใช้

หากมีคำถามค้างอยู่หรือผลไม่มี candidate จะนำเข้าไม่ได้ ถ้าฟอร์มเปลี่ยนระหว่างรอ AI ต้องตีความใหม่

## Validation / สถานะการทดสอบ

ตรวจ response mapping, missing parameters, unsupported rules, quota SQL review, authentication boundary และ production build แล้ว

ยังไม่ได้เรียก OpenAI จริงหรือ apply migration ในบัญชี Supabase ผ่านเครื่องมือนี้ เพราะ session ไม่มี server API key และไม่มี Supabase admin connection การทดสอบออนไลน์ต้องทำหลังตั้งค่าสองส่วนข้างต้น

อ้างอิง [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) และ [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)
