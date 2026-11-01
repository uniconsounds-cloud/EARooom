import { createClient } from "@supabase/supabase-js";
import { runtimeConfig } from "@/lib/strategy/runtime";
import { validateStrategy } from "@/lib/strategy/validation";
import type { Strategy } from "@/lib/strategy/model";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new Response("Invalid strategy id",{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return new Response("Storage unavailable",{status:503});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from("strategies").select("config").eq("id",id).eq("is_public",true).maybeSingle();
  if(error)return new Response("Storage unavailable",{status:503});
  if(!data)return new Response("Public strategy not found",{status:404});
  if(validateStrategy(data.config).length)return new Response("Unsupported strategy",{status:422});
  try{return new Response(runtimeConfig(data.config as Strategy),{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});}catch{return new Response("Strategy contains rules unsupported by engine 0.2.0",{status:422});}
}
