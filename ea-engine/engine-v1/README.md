# EASpaze Engine 0.2.0 / ทดลองกับ Demo และ Strategy Tester

EA รุ่นแรกโหลดค่า Strategy จากเว็บโดยไม่ต้อง compile ใหม่เมื่อเปลี่ยนค่า รองรับ **Simple ไม้เดียว**, EMA / Stochastic / RSI / MA cross / Price cross, ALL/ANY, Trigger 7 แบบ และ Fixed SL/TP หรือ Swing SL + RR

รุ่น 0.2 ต้องใช้ Config ที่ดาวน์โหลดใหม่จาก Builder รุ่น 0.2; EA รุ่น 0.1 จะไม่รับ Config รุ่นใหม่ และ EA รุ่น 0.2 จะไม่รับ Config รุ่นเก่า

Stochastic สองขั้นตรวจแท่งปิด: Buy เข้าโซนต่ำก่อน แล้วรอ %K ตัดขึ้นเหนือ %D; หาก %K กลับเหนือโซนก่อนแท่งที่ตัดจะยกเลิก (Sell กลับด้าน) หากตัดและออกจากโซนในแท่งเดียวกันถือว่าผ่าน จำกัดจำนวนแท่งที่รอได้

Recovery และ advanced exit ยังส่งให้ engine รุ่นนี้ไม่ได้ ปุ่ม Export บนเว็บจะแจ้งกติกาที่ไม่รองรับ

## ไฟล์

- `EASpazeEngine.mq5` + `EngineRules.mqh`: source ที่ต้องอยู่โฟลเดอร์เดียวกันตอน compile
- `RuleConformance.mq5`: Script ตรวจสูตร ไม่เปิดออเดอร์; หากต้องรัน ให้นำ source + .mqh ไปไว้ใน `MQL5/Scripts/EASpazeV1` และ compile Script นั้น แล้วอ่านผล PASS/FAIL ใน Experts
- Compile ไม่ได้ยืนยันผล demo/backtest runtime ต้องทดสอบใน MT5 เพิ่มเติม

## เตรียม Config ส่วนตัว (ไม่ต้องแชร์)

1. ที่เว็บ Builder เลือก Simple และตั้งค่าที่ต้องใช้
2. เปิดแถบ **EA Engine · 0.2.0** ทางขวา → **ดาวน์โหลด Config สำหรับ MT5**
3. ได้ไฟล์ `easpaze.cfg` และดาวน์โหลด Strategy JSON แยกเก็บอ้างอิงได้
4. บน MT5 เปิด **File → Open Data Folder** แล้วหาโฟลเดอร์ **Terminal/Common/Files** ซึ่งเป็น Common Files (ไม่ใช่ MQL5/Files)
5. วิธีหาตำแหน่งที่แน่นอน: เปิด MQL5 Script ที่ Print `TerminalInfoString(TERMINAL_COMMONDATA_PATH)` แล้วเปิดโฟลเดอร์ `Files` ในนั้น
6. วาง `easpaze.cfg` ใน Common Files; EA อ่านใหม่ทุก 15 วินาที

## ติดตั้งและดูสัญญาณ

1. วางไฟล์ compile `EASpazeEngine.ex5` ใน `MQL5/Experts/EASpazeV1`
2. เปิด chart **Symbol และ Timeframe ตรงกับ Config** (รวม suffix ของโบรกเกอร์ เช่น XAUUSDm)
3. Refresh Navigator แล้วลาก EA ลง chart บัญชี Demo
4. Inputs: `InpConfigFile=easpaze.cfg`, `InpConfigUrl` ว่าง, `InpEnableDemoOrders=false`
5. Dashboard ขึ้น `SYNC OK` พร้อม revision และ `MONITOR · ORDERS OFF`
6. รอปิดแท่งใหม่: เมื่อ Setup ผ่านจะขึ้น `SETUP READY · WAIT TRIGGER`; เมื่อ Trigger มาจะรายงาน `TRIGGER READY · MONITOR ONLY` ใน Experts

EA เริ่มตรวจที่แท่งใหม่หลังโหลด config ไม่เข้าออเดอร์ย้อนหลังกลางแท่ง และจะรอ Setup กลับมาใหม่ก่อนเริ่มรอบใหม่

## ทดลองเปิดออเดอร์ใน Demo / Tester

เมื่อตรวจ Config แล้ว ปรับ Inputs → `InpEnableDemoOrders=true` และเปิด Algo Trading ของ MT5

EA ตรวจ volume min/max/step, spread, stop distance และไม่เปิดเพิ่มถ้ามี position ของ Symbol นั้นอยู่ ไม่ปรับ Lot หรือขยับ SL ให้เองเงียบ ๆ หาก broker ไม่รับจะแจ้งข้อผิดพลาด

รุ่นนี้ **ปฏิเสธบัญชีเงินจริง** แม้เปิด Inputs ดังกล่าว และไม่ถูก attach/run อัตโนมัติจากการ compile

ถ้าค่า pip ไม่ตรง ให้ตั้ง `InpPipSize` เอง Default auto: XAU = 0.1, FX 3/5 digits = 10×point, อื่น ๆ = point

## Sync Strategy สาธารณะจากเว็บ

1. ใช้เฉพาะ Strategy ที่ตั้งใจแชร์ และบันทึกลงบัญชีพร้อมเปิด **แชร์ใน Explore**
2. คัดลอก **URL สำหรับ Sync EA** จากกล่อง EA Engine ของ Strategy นั้น
3. ที่ MT5: **Tools → Options → Expert Advisors → Allow WebRequest** เพิ่ม origin ของเว็บ
4. วาง URL ใน Inputs → `InpConfigUrl`
5. ใช้ URL ที่ EA เข้าถึงได้จริง หาก Vercel Preview มี Deployment Protection ให้ใช้วิธีไฟล์ หรือ deployment ที่ได้รับอนุญาตให้เข้าถึง (ไม่เปลี่ยนสิทธิ์เว็บอัตโนมัติ)

API อ่าน **เฉพาะ public strategy ตาม id** ไม่อ่านตัวล่าสุดของคนอื่น ไม่คืน private config และไม่ฝัง service-role key ใน EA

อัปเดต config ขณะมี position จะรอจน position ปิด; sync ผิดพลาดหรือข้อมูลเก่าจะพักการเข้าใหม่ ไม่มีการปิด broker SL/TP เดิมทิ้ง

ยังไม่มี private pairing หรือส่ง heartbeat กลับเว็บ ดังนั้นหน้าเว็บยังไม่ยืนยันว่า MT5 เครื่องใดรับ config แล้ว ดู `SYNC OK · revision` ที่ Dashboard ของ EA เทียบกับ revision ในเว็บก่อน

## Strategy Tester

ใช้ไฟล์ Config ใน Common Files และเลือก EA ตัวเดิม; `WebRequest` ใช้ใน Tester ไม่ได้ จึงใช้ไฟล์แทน URL อัตโนมัติ

เริ่มทดสอบแบบ single run ก่อน (ไม่ทำ optimization ที่หลาย agent แก้ไฟล์เดียวกัน) รายงานผลจาก MT5 ยังต้องนำกลับเว็บด้วยขั้นตอนถัดไป

## ตรวจสูตร

Web: `npm run check:strategy` ใช้ fixture ชุดเดียวกับนิยามใน `docs/STRATEGY_CONTRACT.md`

ลาก `RuleConformance` จาก Navigator → Scripts ไป chart และดูข้อความ `14 passed, 0 failed` ใน Experts เพื่อยืนยัน runtime ของ MQL5; การ compile เพียงอย่างเดียวไม่ยืนยันผล runtime

ดูข้อจำกัด [WebRequest](https://www.mql5.com/en/docs/network/webrequest) และ [Strategy Tester](https://www.mql5.com/en/docs/runtime/testing)
