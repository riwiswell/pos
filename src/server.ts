import "w3c-hr-time";
import webpush from "web-push";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type Env={SUPABASE_URL?:string;SUPABASE_SERVICE_ROLE_KEY?:string;SUPABASE_PUBLISHABLE_KEY?:string;VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string;WISWELLART_WEBHOOK_SECRET?:string;WISWELLART_USER_ID?:string};
type ServerEntry={fetch:(request:Request,env:unknown,ctx:unknown)=>Promise<Response>|Response};

let serverEntryPromise:Promise<ServerEntry>|undefined;
async function getServerEntry(){if(!serverEntryPromise)serverEntryPromise=import("@tanstack/react-start/server-entry").then(m=>(m.default??m) as ServerEntry);return serverEntryPromise}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8"}})}
async function supabaseFetch(env:Env,path:string,init:RequestInit={}){if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Supabase server credentials are not configured");const headers=new Headers(init.headers);headers.set("apikey",env.SUPABASE_SERVICE_ROLE_KEY);headers.set("Authorization","Bearer "+env.SUPABASE_SERVICE_ROLE_KEY);headers.set("Content-Type","application/json");headers.set("Prefer","return=representation");return fetch(env.SUPABASE_URL+"/rest/v1/"+path,{...init,headers})}
async function userFromBearer(request:Request,env:Env){const auth=request.headers.get("Authorization");if(!auth||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return null;const r=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:auth}});if(!r.ok)return null;return await r.json() as {id:string}}
async function handleApi(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname==="/api/push-subscription"&&request.method==="POST"){const u=await userFromBearer(request,env);if(!u)return json({error:"Unauthorized"},401);const body=await request.json() as {endpoint?:string;subscription?:unknown;expiration_time?:string|null};if(!body.endpoint||!body.subscription)return json({error:"Invalid subscription"},400);const r=await supabaseFetch(env,"push_subscriptions?on_conflict=user_id%2Cendpoint",{method:"POST",body:JSON.stringify({user_id:u.id,endpoint:body.endpoint,subscription:body.subscription,expiration_time:body.expiration_time??null})});return new Response(await r.text(),{status:r.status,headers:{"content-type":"application/json"}})}
 if(url.pathname==="/api/integrations/wiswellart"&&request.method==="POST"){if(!env.WISWELLART_WEBHOOK_SECRET||request.headers.get("x-pos-integration-secret")!==env.WISWELLART_WEBHOOK_SECRET)return json({error:"Unauthorized"},401);if(!env.WISWELLART_USER_ID)return json({error:"WISWELLART_USER_ID not configured"},500);const b=await request.json() as {period_start:string;period_end:string;income:number;expense:number;raw_payload?:unknown};const source=await supabaseFetch(env,"finance_external_sources?user_id=eq."+encodeURIComponent(env.WISWELLART_USER_ID)+"&source_key=eq.wiswellart",{method:"POST",body:JSON.stringify({user_id:env.WISWELLART_USER_ID,source_key:"wiswellart",name:"WíswellArt · Tienda",active:true})});const sourceRows=await source.json() as any[];const sourceId=sourceRows?.[0]?.id;if(!sourceId)return json({error:"Could not create source"},500);const r=await supabaseFetch(env,"finance_external_snapshots",{method:"POST",body:JSON.stringify({user_id:env.WISWELLART_USER_ID,source_id:sourceId,period_start:b.period_start,period_end:b.period_end,income:Number(b.income)||0,expense:Number(b.expense)||0,raw_payload:b.raw_payload??{}})});return new Response(await r.text(),{status:r.status,headers:{"content-type":"application/json"}})}
 return null;
}
async function dispatchDueNotifications(env:Env){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)return;
 webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
 const due=await supabaseFetch(env,"notification_jobs?status=eq.pending&fire_at=lte."+encodeURIComponent(new Date().toISOString())+"&order=fire_at.asc&limit=100");
 if(!due.ok)return;const jobs=await due.json() as any[];
 for(const job of jobs){
   const subs=await supabaseFetch(env,"push_subscriptions?user_id=eq."+encodeURIComponent(job.user_id));if(!subs.ok)continue;
   for(const row of await subs.json() as any[]){try{await webpush.sendNotification(row.subscription,JSON.stringify({title:job.title,body:job.body??"",tag:job.id,data:{type:"scheduled-notification",url:"/alarmas"}}));}catch(e){const status=(e as any)?.statusCode;if(status===404||status===410)await supabaseFetch(env,"push_subscriptions?id=eq."+row.id,{method:"DELETE"});}}
   await supabaseFetch(env,"notification_jobs?id=eq."+job.id,{method:"PATCH",body:JSON.stringify({status:"sent",sent_at:new Date().toISOString()})});\n   const repeat=job.payload?.repeat_rule; if(repeat==="daily"||repeat==="weekly"){const next=new Date(job.fire_at);next.setDate(next.getDate()+ (repeat==="weekly"?7:1)); if(next.getTime()>Date.now()-60000) await supabaseFetch(env,"notification_jobs",{method:"POST",body:JSON.stringify({user_id:job.user_id,source_type:job.source_type,source_id:job.source_id,fire_at:next.toISOString(),title:job.title,body:job.body,payload:job.payload,status:"pending"})});}
 }
}
async function normalizeCatastrophicSsrResponse(response:Response){if(response.status<500)return response;const ct=response.headers.get("content-type")??"";if(!ct.includes("application/json"))return response;const body=await response.clone().text();try{const p=JSON.parse(body);if(p.unhandled===true&&p.message==="HTTPError"){console.error(consumeLastCapturedError()??new Error("h3 swallowed SSR error"));return new Response(renderErrorPage(),{status:500,headers:{"content-type":"text/html; charset=utf-8"}})}}catch{}return response}

export default {
 async fetch(request:Request,env:Env,ctx:unknown){try{const api=await handleApi(request,env);if(api)return api;const handler=await getServerEntry();return await normalizeCatastrophicSsrResponse(await handler.fetch(request,env,ctx));}catch(error){console.error(error);return new Response(renderErrorPage(),{status:500,headers:{"content-type":"text/html; charset=utf-8"}})}},
 async scheduled(_controller:unknown,env:Env,ctx:{waitUntil:(p:Promise<unknown>)=>void}){ctx.waitUntil(dispatchDueNotifications(env))}
};
