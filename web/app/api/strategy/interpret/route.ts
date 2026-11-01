import { createClient } from "@supabase/supabase-js";
import { applyInterpretation, interpretationSchema, interpreterInstructions } from "@/lib/strategy/interpreter";
import { validateStrategy } from "@/lib/strategy/validation";
import type { Strategy } from "@/lib/strategy/model";
export const maxDuration=60;
export async function POST(request:Request){
  if(Number(request.headers.get("content-length")??0)>40000)return Response.json({error:"คำอธิบายยาวเกินไป"},{status:413});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!pub)return Response.json({error:"ยังไม่ได้ตั้งค่าบัญชีผู้ใช้"},{status:503});
  const auth=request.headers.get("authorization")??"";
  if(!auth.startsWith("Bearer "))return Response.json({error:"กรุณาเข้าสู่ระบบก่อนใช้ AI"},{status:401});
  const db=createClient(url,pub,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.auth.getUser(auth.slice(7));
  if(error||!data.user)return Response.json({error:"กรุณาเข้าสู่ระบบอีกครั้ง"},{status:401});
  const key=process.env.OPENAI_API_KEY;
  if(!key)return Response.json({error:"Describe to AI ยังไม่เปิดใช้งาน · ตั้ง OPENAI_API_KEY ฝั่ง Vercel ก่อน ส่วน Manual Builder ใช้งานได้ตามปกติ"},{status:503});
  let body: {description?:unknown;strategy?:unknown};
  try{const text=await request.text();if(text.length>40000)return Response.json({error:"ข้อมูลยาวเกินไป"},{status:413});body=JSON.parse(text);}catch{return Response.json({error:"อ่านข้อมูลไม่สำเร็จ"},{status:400});}
  if(typeof body.description!=="string"||body.description.trim().length<8||body.description.length>8000)return Response.json({error:"อธิบาย Strategy ระหว่าง 8–8,000 ตัวอักษร"},{status:400});
  if(validateStrategy(body.strategy).length)return Response.json({error:"ค่าปัจจุบันในฟอร์มไม่ถูกต้อง กรุณาตรวจค่าก่อนใช้ AI"},{status:400});
  const quota=await db.rpc("consume_strategy_ai_quota");
  if(quota.error)return Response.json({error:"ยังไม่พร้อมเปิด AI · ผู้ดูแลต้องติดตั้ง migration strategy_ai_quota ใน Supabase ก่อน"},{status:503});
  if(quota.data!==true)return Response.json({error:"ใช้ AI ครบโควตาวันนี้แล้ว ลองใหม่วันถัดไป"},{status:429});
  try{
    const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:process.env.OPENAI_STRATEGY_MODEL??"gpt-5-mini",store:false,max_output_tokens:6000,instructions:interpreterInstructions,input:JSON.stringify({description:body.description,currentForm:body.strategy}),text:{format:{type:"json_schema",name:"strategy_interpretation",strict:true,schema:interpretationSchema}}})});
    if(!res.ok)return Response.json({error:"AI ยังตอบกลับไม่สำเร็จ กรุณาลองใหม่ภายหลัง"},{status:502});
    const response=await res.json();if(response.status!=="completed")return Response.json({error:"AI ตีความยังไม่ครบ ลองย่อคำอธิบายหรือแยกเป็นขั้น"},{status:502});
    const text=(response.output??[]).flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).filter((c:{type:string})=>c.type==="output_text").map((c:{text:string})=>c.text).join("");
    return Response.json(applyInterpretation(JSON.parse(text),body.strategy as Strategy),{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"AI ใช้เวลานานหรือส่งข้อมูลที่ไม่รองรับ กรุณาลองอธิบายอีกครั้ง"},{status:502});}
}
