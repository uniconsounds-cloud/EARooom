# Strategy Contract / แนวทางที่ลงมือทำแล้ว

อ้างอิงข้อกำหนดหลักใน [CORE_FEATURES.md](CORE_FEATURES.md) โดยไม่เปลี่ยนสเปกต้นฉบับ

## เส้นทางข้อมูล

Manual Builder หรือ AI review → `Strategy` ใน `web/lib/strategy/model.ts`

- schemaVersion 1: รักษารูปแบบข้อมูลเดิมใน Supabase
- contractVersion / rule version `1.0.0`: นิยามสูตรและพฤติกรรม
- EA Engine `0.1.0`: ชุดความสามารถรุ่นแรก (เลขใน MetaEditor คือ 1.000 เพื่อให้ผ่านข้อกำหนดตัว compiler)
- `validation.ts` ตรวจค่าจากทั้งสองเส้นทาง
- `scenario.ts` สร้างข้อมูลจำลองหลายรูปแบบแล้วใช้ evaluator เลือกตัวอย่างที่แสดงกติกาได้
- `evaluator.ts` ประเมิน Indicator, Setup, Trigger และ Simple Exit
- `runtime.ts` แปลง Strategy JSON เดิมเป็น line protocol `easpaze.cfg` สำหรับ MT5

ไฟล์ `.cfg` เป็น output ของ adapter ไม่ใช่ Strategy อีกรูปแบบให้ผู้ใช้สร้างแยกเอง

## นิยามกติกา 1.0.0

- Setup อ่านแท่งที่ปิดแล้วเท่านั้น และรวมด้วย ALL/ANY
- EMA เริ่มด้วย SMA ของ period แรก จากนั้น smoothing 2/(period+1)
- RSI ใช้ Wilder smoothing; ราคาไม่เปลี่ยนทั้ง gain/loss ใช้ 50
- Stochastic: raw %K จาก highest high / lowest low แล้ว SMA Slowing และ SMA %D ตามลำดับ; ข้อมูลยังไม่ครบเป็น null
- Cross up = ค่าก่อนหน้า <= เส้นเทียบ และค่าปัจจุบัน > เส้นเทียบ; Cross down กลับด้าน
- Signal เกิดเมื่อ Setup เปลี่ยนจากไม่ผ่านเป็นผ่าน แต่ละชุดใช้สัญญาณเดียวจน Setup ถูกยกเลิก/กลับมาใหม่
- Immediate ส่ง Market order ที่ tick แรกหลังแท่งสัญญาณปิด; next_bar_open ส่งที่ tick แรกของแท่งถัดไป (ภายใต้ closed-bar Setup ทั้งสองแบบจึงอาจเป็น tick เดียวกัน)
- Delay เริ่มนับเมื่อแท่งสัญญาณปิด; ระหว่างรอแต่ละแท่งต้องตรวจ Setup อีกครั้ง; ยกเลิกเมื่อหมดอายุ
- Price move อ้างราคาปิดของแท่งสัญญาณ; breakout อ้าง High/Low ของแท่งนั้น
- Pullback อ้าง EMA ล่าสุดที่คำนวณจากแท่งปิด; EA รอราคา Ask/Bid แตะใน buffer
- Swing SL ล็อก High/Low จาก lookback ก่อนสัญญาณพร้อม; TP = ระยะ entry ถึง SL × RR; ถ้า SL อยู่ผิดฝั่ง ปฏิเสธ
- Simple มีได้หนึ่ง position ต่อ Symbol; หาก Buy/Sell พร้อมกันให้ Buy มีลำดับก่อน

## ขอบเขตกราฟจำลอง

กราฟใช้ evaluator กลาง ไม่มีโค้ดกติกา Indicator อีกชุดอยู่ใน component; animation เป็นเพียงการเปลี่ยนตำแหน่งภาพ

เลือกสถานการณ์ที่แสดงเงื่อนไขได้ ไม่ได้เลือกเพื่อโชว์กำไร และไม่รับประกันว่าจะหากรณีผ่านได้ทุกชุด

- แสดง Indicator ทุกตัว รวม RSI/Stoch หลายแผง
- ดูจำนวนเงื่อนไขที่ผ่านบนแท่งตัวอย่าง/แท่งที่ชี้เมาส์
- ไม่มีลูกศร Entry ถ้า Setup/Trigger ไม่ผ่าน
- Manual confirmation แสดงรอยืนยัน ไม่สร้างออเดอร์สมมติ
- คำนวณจุดออกจากแท่งหลัง entry เท่านั้น ถ้าแท่งเดียวแตะ TP และ SL จะแสดง `?` เพราะ OHLC ไม่บอกลำดับภายในแท่ง
- Delay ใช้ตำแหน่งภายในแท่งแบบภาพประกอบ ไม่ใช่ tick จริง; ไม้แรกของ Recovery แสดงได้ แต่ยังไม่จำลองไม้แก้/Basket Exit
- ค่า point=0.01 และ pip=0.1 สำหรับภาพตัวอย่างทองคำ ไม่ใช่ metadata ราคาจริงของโบรกเกอร์
- ไม่รวม spread/slippage/commission และไม่ใช่ Backtest

## ความสอดคล้องเว็บกับ EA

JS กับ MQL5 รันคนละภาษา จึงใช้ contract/นิยามสูตรเดียวกัน พร้อม fixture `fixtures/rule-vectors.json` และ MQL5 `RuleConformance.mq5` ตรวจสูตรข้ามภาษา

ตรวจบนเว็บด้วย `npm run check:strategy` ส่วนสคริปต์ MQL5 compile แล้ว แต่ต้องรันบน MT5 เพื่อยืนยันผล runtime อีกครั้งก่อนถือว่าผ่านการทดสอบข้ามระบบ

## สิ่งที่รุ่นแรกยังไม่ทำ

- Recovery / Hedge / advanced exit ใน EA (adapter ปฏิเสธ ไม่ตัดกติกาทิ้งแล้วรันต่อ)
- private pairing, heartbeat จาก EA กลับเว็บ, remote kill switch, สั่ง MT5 Tester จากเว็บ
- Voice / Video interpretation
- คำสั่งเทรดบนบัญชีจริง (EA รุ่นนี้ไม่อนุญาต)
