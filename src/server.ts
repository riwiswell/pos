import webpush from "web-push";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type Env={SUPABASE_URL?:string;SUPABASE_SERVICE_ROLE_KEY?:string;SUPABASE_PUBLISHABLE_KEY?:string;VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string;WISWELLART_WEBHOOK_SECRET?:string;WISWELLART_USER_ID?:string};
type ServerEntry={fetch:(request:Request,env:unknown,ctx:unknown)=>Promise<Response>|Response};
const ALLOWED_PUSH_HOSTS = [
 "fcm.googleapis.com",
 "updates.push.services.mozilla.com",
 "push.services.mozilla.com",
 "webpush.push.apple.com",
 "web.push.apple.com",
];
function isAllowedPushEndpoint(value:string){
 try {
  const url=new URL(value);
  return url.protocol==="https:" && !url.username && !url.password &&
    ALLOWED_PUSH_HOSTS.some(host=>url.hostname===host||url.hostname.endsWith("."+host));
 } catch { return false; }
}

let serverEntryPromise:Promise<ServerEntry>|undefined;
async function getServerEntry(){if(!serverEntryPromise)serverEntryPromise=import("@tanstack/react-start/server-entry").then(m=>(m.default??m) as ServerEntry);return serverEntryPromise}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8"}})}
async function supabaseFetch(env:Env,path:string,init:RequestInit={}){if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Supabase server credentials are not configured");const headers=new Headers(init.headers);headers.set("apikey",env.SUPABASE_SERVICE_ROLE_KEY);headers.set("Authorization","Bearer "+env.SUPABASE_SERVICE_ROLE_KEY);headers.set("Content-Type","application/json");if(!headers.has("Prefer"))headers.set("Prefer","return=representation");return fetch(env.SUPABASE_URL+"/rest/v1/"+path,{...init,headers})}
async function userFromBearer(request:Request,env:Env){const auth=request.headers.get("Authorization");if(!auth||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return null;const r=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:auth}});if(!r.ok)return null;return await r.json() as {id:string}}
function annualDate(reference:string,year:number):Date|null{const month=Number(reference.slice(5,7)),day=Number(reference.slice(8,10));if(!Number.isInteger(month)||!Number.isInteger(day)||month<1||month>12||day<1||day>31)return null;const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCMonth()!==month-1)return new Date(Date.UTC(year,month,0));return date}
async function syncRelationshipJobs(env:Env,userId:string,enabled:boolean){
 const base="notification_jobs?user_id=eq."+encodeURIComponent(userId)+"&source_type=eq.relationship&status=eq.pending";
 const cancelled=await supabaseFetch(env,base,{method:"PATCH",body:JSON.stringify({status:"cancelled"})});
 if(!cancelled.ok)throw new Error("No se pudieron cancelar los recordatorios anteriores");
 if(!enabled)return {scheduled:0};
 const read=await supabaseFetch(env,"relationships?user_id=eq."+encodeURIComponent(userId)+"&select=id,name,birthday,anniversary,next_contact_on&order=name.asc&limit=1000");
 if(!read.ok)throw new Error("No se pudieron leer las relaciones");
 const relationships=await read.json() as any[];
 const now=new Date();const jobs:any[]=[];
 const add=(r:any,fireAt:Date,title:string,body:string,kind:string,eventOn:string)=>{if(fireAt.getTime()>now.getTime())jobs.push({user_id:userId,source_type:"relationship",source_id:r.id,fire_at:fireAt.toISOString(),title,body,payload:{kind,event_on:eventOn},status:"pending"})};
 for(const relation of relationships){
  const name=String(relation.name||"Relación importante");
  for(const [field,kind,label] of [["birthday","birthday","Cumpleaños"],["anniversary","anniversary","Aniversario"]] as const){
   const reference=relation[field] as string|null;if(!reference)continue;
   let event=annualDate(reference,now.getUTCFullYear());if(!event)continue;
   if(event.getTime()<Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()))event=annualDate(reference,now.getUTCFullYear()+1)??event;
   add(relation,new Date(event.getTime()-7*86400000),label+" de "+name,label+" de "+name+" en una semana.",kind,event.toISOString().slice(0,10));
  }
  if(relation.next_contact_on){const fire=new Date(String(relation.next_contact_on)+"T00:00:00.000Z");add(relation,fire,"Seguimiento: "+name,"Hoy tienes previsto cuidar esta relación.","relationship_follow_up",String(relation.next_contact_on))}
 }
 if(jobs.length){const created=await supabaseFetch(env,"notification_jobs",{method:"POST",body:JSON.stringify(jobs)});if(!created.ok)throw new Error("No se pudieron volver a programar los recordatorios")}
 return {scheduled:jobs.length};
}
async function handleApi(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname==="/api/push-config"&&request.method==="GET")return new Response(JSON.stringify({vapidPublicKey:env.VAPID_PUBLIC_KEY??null}),{status:200,headers:{"content-type":"application/json;charset=utf-8","cache-control":"public, max-age=300"}});
 if(url.pathname==="/api/push-subscription"&&request.method==="POST"){
  const u=await userFromBearer(request,env);if(!u)return json({error:"Unauthorized"},401);
  let body:{endpoint?:string;subscription?:{endpoint?:string;keys?:{p256dh?:string;auth?:string}};expiration_time?:string|null};
  try{body=await request.json() as typeof body}catch{return json({error:"Invalid JSON body"},400)}
  if(!body.endpoint||!isAllowedPushEndpoint(body.endpoint)||!body.subscription||
     body.subscription.endpoint!==body.endpoint||
     typeof body.subscription.keys?.p256dh!=="string"||!body.subscription.keys.p256dh||
     typeof body.subscription.keys?.auth!=="string"||!body.subscription.keys.auth){
    return json({error:"Invalid push subscription"},400);
  }
  const r=await supabaseFetch(env,"push_subscriptions?on_conflict=user_id%2Cendpoint",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify({user_id:u.id,endpoint:body.endpoint,subscription:body.subscription,expiration_time:body.expiration_time??null})
  });
  return new Response(await r.text(),{status:r.status,headers:{"content-type":"application/json"}});
 }

 if(url.pathname==="/api/notification-preferences"&&request.method==="POST"){
  const u=await userFromBearer(request,env);if(!u)return json({error:"Unauthorized"},401);
  let body:{relationships?:unknown};
  try{body=await request.json() as typeof body}catch{return json({error:"Invalid JSON body"},400)}
  if(typeof body.relationships!=="boolean")return json({error:"relationships must be boolean"},400);
  try{return json(await syncRelationshipJobs(env,u.id,body.relationships))}catch(error){return json({error:error instanceof Error?error.message:"Could not sync relationship notifications"},500)}
 }
 if(url.pathname==="/api/integrations/wiswellart"&&request.method==="POST"){
  if(!env.WISWELLART_WEBHOOK_SECRET||request.headers.get("x-pos-integration-secret")!==env.WISWELLART_WEBHOOK_SECRET)return json({error:"Unauthorized"},401);
  if(!env.WISWELLART_USER_ID)return json({error:"WISWELLART_USER_ID not configured"},500);
  const b=await request.json() as {period_start:string;period_end:string;income:number;expense:number;raw_payload?:unknown};
  if(!b.period_start||!b.period_end)return json({error:"period_start and period_end are required"},400);
  const qs="finance_external_sources?user_id=eq."+encodeURIComponent(env.WISWELLART_USER_ID)+"&source_key=eq.wiswellart&limit=1";
  const sourceRead=await supabaseFetch(env,qs);
  if(!sourceRead.ok)return new Response(await sourceRead.text(),{status:sourceRead.status,headers:{"content-type":"application/json"}});
  const existing=await sourceRead.json() as any[];
  let sourceId=existing?.[0]?.id;
  if(!sourceId){
    const sourceCreate=await supabaseFetch(env,"finance_external_sources",{method:"POST",body:JSON.stringify({user_id:env.WISWELLART_USER_ID,source_key:"wiswellart",name:"WíswellArt · Tienda",active:true})});
    if(!sourceCreate.ok)return new Response(await sourceCreate.text(),{status:sourceCreate.status,headers:{"content-type":"application/json"}});
    sourceId=(await sourceCreate.json() as any[])?.[0]?.id;
  }
  if(!sourceId)return json({error:"Could not resolve WíswellArt source"},500);
  const lookup="finance_external_snapshots?source_id=eq."+encodeURIComponent(sourceId)+"&period_start=eq."+encodeURIComponent(b.period_start)+"&period_end=eq."+encodeURIComponent(b.period_end)+"&limit=1";
  const snapRead=await supabaseFetch(env,lookup);
  if(!snapRead.ok)return new Response(await snapRead.text(),{status:snapRead.status,headers:{"content-type":"application/json"}});
  const snap=await snapRead.json() as any[];
  const payload={user_id:env.WISWELLART_USER_ID,source_id:sourceId,period_start:b.period_start,period_end:b.period_end,income:Number(b.income)||0,expense:Number(b.expense)||0,raw_payload:b.raw_payload??{}};
  const snapWrite=snap?.[0]?.id
    ? await supabaseFetch(env,"finance_external_snapshots?id=eq."+encodeURIComponent(snap[0].id),{method:"PATCH",body:JSON.stringify(payload)})
    : await supabaseFetch(env,"finance_external_snapshots",{method:"POST",body:JSON.stringify(payload)});
  return new Response(await snapWrite.text(),{status:snapWrite.status,headers:{"content-type":"application/json"}});
 }
 return null;
}
async function finalizeAlarmOccurrence(env:Env,job:any){
 const alarmRead=await supabaseFetch(env,"alarms?id=eq."+encodeURIComponent(job.source_id)+"&user_id=eq."+encodeURIComponent(job.user_id)+"&limit=1");
 if(!alarmRead.ok)throw new Error("Could not load alarm after occurrence");
 const rows=await alarmRead.json() as any[];
 const alarm=rows[0];
 if(!alarm||!alarm.enabled)return;
 const now=new Date();
 const currentDue=new Date(alarm.snoozed_until??alarm.alarm_at);
 // The job may have become stale while a user edited or disabled the alarm.
 if(Number.isFinite(currentDue.getTime())&&currentDue.getTime()>now.getTime())return;
 const firedAt=now.toISOString();
 if(alarm.repeat_rule==="daily"||alarm.repeat_rule==="weekly"){
  const next=new Date(alarm.alarm_at);
  const stepDays=alarm.repeat_rule==="weekly"?7:1;
  do{next.setDate(next.getDate()+stepDays)}while(next.getTime()<=now.getTime());
  const updated=await supabaseFetch(env,"alarms?id=eq."+encodeURIComponent(job.source_id)+"&user_id=eq."+encodeURIComponent(job.user_id),{method:"PATCH",body:JSON.stringify({alarm_at:next.toISOString(),last_fired_at:firedAt,snoozed_until:null})});
  if(!updated.ok)throw new Error("Could not advance repeating alarm");
  // The database trigger creates exactly one next notification_jobs row.
 }else{
  const disabled=await supabaseFetch(env,"alarms?id=eq."+encodeURIComponent(job.source_id)+"&user_id=eq."+encodeURIComponent(job.user_id),{method:"PATCH",body:JSON.stringify({enabled:false,last_fired_at:firedAt,snoozed_until:null})});
  if(!disabled.ok)throw new Error("Could not disable fired one-time alarm");
 }
}

async function dispatchDueNotifications(env:Env){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)return;
 webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
 // Only dequeue jobs for users who can receive them. Otherwise the first 100
 // pending jobs belonging to unsubscribed users can starve every later job.
 const subscriptionRows=await supabaseFetch(env,"push_subscriptions?select=user_id&limit=1000");
 if(!subscriptionRows.ok)return;
 const userIds=Array.from(new Set((await subscriptionRows.json() as {user_id:string}[]).map((row)=>row.user_id).filter(Boolean)));
 if(userIds.length===0)return;
 const userFilter=encodeURIComponent("in.("+userIds.join(",")+")");
 const due=await supabaseFetch(env,"notification_jobs?status=eq.pending&fire_at=lte."+encodeURIComponent(new Date().toISOString())+"&user_id="+userFilter+"&order=fire_at.asc&limit=100");
 if(!due.ok)return;const jobs=await due.json() as any[];
 for(const job of jobs){
   if(job.source_type==="relationship"){
    const prefRead=await supabaseFetch(env,"profiles?id=eq."+encodeURIComponent(job.user_id)+"&select=notification_preferences&limit=1");
    if(!prefRead.ok){await supabaseFetch(env,"notification_jobs?id=eq."+encodeURIComponent(job.id),{method:"PATCH",body:JSON.stringify({fire_at:new Date(Date.now()+5*60_000).toISOString()})});console.error("[push] Could not verify relationship notification preference; deferred",job.id);continue;}
    const prefRows=await prefRead.json() as any[];
    if(prefRows[0]?.notification_preferences?.relationships===false){
     await supabaseFetch(env,"notification_jobs?id=eq."+encodeURIComponent(job.id),{method:"PATCH",body:JSON.stringify({status:"cancelled"})});
     continue;
    }
   }
   const subs=await supabaseFetch(env,"push_subscriptions?user_id=eq."+encodeURIComponent(job.user_id));if(!subs.ok)continue;
   const subscriptions=await subs.json() as any[];
   if(subscriptions.length===0){
    await supabaseFetch(env,"notification_jobs?id=eq."+encodeURIComponent(job.id),{method:"PATCH",body:JSON.stringify({status:"failed"})});
    if(job.source_type==="alarm"){try{await finalizeAlarmOccurrence(env,job)}catch(error){console.error("[push] Could not advance undeliverable alarm",job.id,error)}}
    console.warn("[push] No subscribed device; marking notification job as failed",job.id);
    continue;
   }
   const payload=job.payload&&typeof job.payload==="object"?job.payload as Record<string,unknown>:{};
   const targetByType:Record<string,string>={medication_dose:"/salud",medical_appointment:"/salud",relationship:"/relaciones",work_session:"/trabajo",alarm:"/alarmas"};
   const targetUrl=targetByType[job.source_type]??"/inicio";
   const notificationTag=job.source_type==="medication_dose"?`pos:medication:${job.source_id}`:job.source_type==="alarm"?`pos:alarm:${job.source_id}`:job.id;
   const notification={title:job.title,body:job.body??"",tag:notificationTag,data:{type:"scheduled-notification",url:targetUrl,...(job.source_type==="medication_dose"&&typeof payload.dose_id==="string"?{doseId:payload.dose_id}:{})}};
   let delivered=0;
   let retryableFailure=false;
   for(const row of subscriptions){try{await webpush.sendNotification(row.subscription,JSON.stringify(notification));delivered+=1;}catch(e){const status=(e as any)?.statusCode;if(status===404||status===410){await supabaseFetch(env,"push_subscriptions?id=eq."+encodeURIComponent(row.id),{method:"DELETE"});}else{retryableFailure=true;}}}
   // Avoid leaving permanently undeliverable jobs at the head of the due queue.
   if(delivered===0){
    if(retryableFailure){
     await supabaseFetch(env,"notification_jobs?id=eq."+encodeURIComponent(job.id),{method:"PATCH",body:JSON.stringify({fire_at:new Date(Date.now()+5*60_000).toISOString()})});
     console.warn("[push] Temporary delivery failure; rescheduled for retry",job.id);
    }else{
     await supabaseFetch(env,"notification_jobs?id=eq."+encodeURIComponent(job.id),{method:"PATCH",body:JSON.stringify({status:"failed"})});
     if(job.source_type==="alarm"){try{await finalizeAlarmOccurrence(env,job)}catch(error){console.error("[push] Could not advance expired-subscription alarm",job.id,error)}}
     console.warn("[push] All push subscriptions expired; marking job as failed",job.id);
    }
    continue;
   }
   const marked=await supabaseFetch(env,"notification_jobs?id=eq."+encodeURIComponent(job.id),{method:"PATCH",body:JSON.stringify({status:"sent",sent_at:new Date().toISOString()})});
   if(!marked.ok){console.error("[push] Delivered notification but could not mark job as sent",job.id);continue;}
   const repeat=job.payload?.repeat_rule;
   if(job.source_type==="alarm"){
    try{await finalizeAlarmOccurrence(env,job)}catch(error){console.error("[push] Could not synchronize fired alarm",job.source_id,error)}
   }
   else if(repeat==="daily"||repeat==="weekly"){
    const next=new Date(job.fire_at);
    const stepDays=repeat==="weekly"?7:1;
    do{next.setDate(next.getDate()+stepDays)}while(next.getTime()<=Date.now());
    await supabaseFetch(env,"notification_jobs",{method:"POST",body:JSON.stringify({user_id:job.user_id,source_type:job.source_type,source_id:job.source_id,fire_at:next.toISOString(),title:job.title,body:job.body,payload:job.payload,status:"pending"})});
   }
 }
}
async function normalizeCatastrophicSsrResponse(response:Response){if(response.status<500)return response;const ct=response.headers.get("content-type")??"";if(!ct.includes("application/json"))return response;const body=await response.clone().text();try{const p=JSON.parse(body);if(p.unhandled===true&&p.message==="HTTPError"){console.error(consumeLastCapturedError()??new Error("h3 swallowed SSR error"));return new Response(renderErrorPage(),{status:500,headers:{"content-type":"text/html; charset=utf-8"}})}}catch{}return response}

export default {
 async fetch(request:Request,env:Env,ctx:unknown){try{const api=await handleApi(request,env);if(api)return api;const handler=await getServerEntry();return await normalizeCatastrophicSsrResponse(await handler.fetch(request,env,ctx));}catch(error){console.error(error);return new Response(renderErrorPage(),{status:500,headers:{"content-type":"text/html; charset=utf-8"}})}},
 async scheduled(_controller:unknown,env:Env,ctx:{waitUntil:(p:Promise<unknown>)=>void}){ctx.waitUntil(dispatchDueNotifications(env))}
};
