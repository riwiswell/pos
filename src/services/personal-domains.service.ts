import { supabase } from "@/integrations/supabase/client";
type TableName="alarms"|"health_metrics"|"health_bowel_logs"|"journal_entries"|"shopping_items"|"learning_items"|"relationships"|"work_items"|"spiritual_entries"|"ai_insights"|"gamification_profiles"|"shopping_lists";
const db=supabase as any;

type SleepSessionWrite = { id:string; startDate:string; bedtime:string; endDate:string; wakeTime:string; kind:"sleep"|"nap" };
function sleepDateTimeMinutes(date:string,time:string):number|null {
 const dm=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date),tm=/^(\d{2}):(\d{2})$/.exec(time);
 if(!dm||!tm)return null;
 const y=Number(dm[1]),m=Number(dm[2]),d=Number(dm[3]),h=Number(tm[1]),min=Number(tm[2]);
 if(m<1||m>12||h>23||min>59)return null;
 const stamp=Date.UTC(y,m-1,d,h,min),check=new Date(stamp);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;
 return Math.floor(stamp/60000);
}
function shiftSleepDate(date:string,days:number):string {
 const p=date.split("-").map(Number),v=new Date(Date.UTC(p[0]??1970,(p[1]??1)-1,p[2]??1));
 v.setUTCDate(v.getUTCDate()+days);
 return [v.getUTCFullYear(),String(v.getUTCMonth()+1).padStart(2,"0"),String(v.getUTCDate()).padStart(2,"0")].join("-");
}
function normalizeStoredSleepSessions(sleep:Record<string,any>,metricDate:string):SleepSessionWrite[] {
 const raw=Array.isArray(sleep.sessions)?sleep.sessions:[];
 const source=raw.length?raw:sleep.bedtime&&sleep.wakeTime?[{bedtime:sleep.bedtime,wakeTime:sleep.wakeTime}]:[];
 return source.map((item:any,index:number)=>{
  const bedtime=typeof item?.bedtime==="string"?item.bedtime:"",wakeTime=typeof item?.wakeTime==="string"?item.wakeTime:"";
  const startDate=typeof item?.startDate==="string"?item.startDate:typeof item?.start_date==="string"?item.start_date:metricDate;
  const endDate=typeof item?.endDate==="string"?item.endDate:typeof item?.end_date==="string"?item.end_date:bedtime&&wakeTime&&wakeTime<bedtime?shiftSleepDate(startDate,1):startDate;
  return {id:typeof item?.id==="string"?item.id:`legacy-${metricDate}-${index}-${bedtime}-${wakeTime}`,startDate,bedtime,endDate,wakeTime,kind:item?.kind==="nap"?"nap" as const:"sleep" as const};
 }).filter((x:SleepSessionWrite)=>x.bedtime&&x.wakeTime&&sleepDateTimeMinutes(x.startDate,x.bedtime)!==null&&sleepDateTimeMinutes(x.endDate,x.wakeTime)!==null);
}

export const personalDomainsService={
 async personalInsights(){const optional=async(q:any)=>{const r=await q;return r.error&&["42P01","PGRST205"].includes(r.error.code)?{data:[],error:null}:r};const [health,goals,learning,relations,work,alarms]=await Promise.all([
  db.from("health_metrics").select("metric_date,weight_kg,sleep_hours,exercise_minutes,water_liters").order("metric_date",{ascending:false}).limit(14),
  optional(db.from("life_goals").select("title,progress,status,target_date").eq("status","active") .limit(20)),
  db.from("learning_items").select("title,kind,progress,status").eq("status","active").limit(20),
  optional(db.from("relationships").select("name,last_contact_on,next_contact_on,relationship_type").limit(20)),
  db.from("work_items").select("title,status,target_date,kind").neq("status","done").limit(20),
  db.from("alarms").select("title,alarm_at,enabled").eq("enabled",true).limit(20)
 ]);const errors=[health,goals,learning,relations,work,alarms].filter(x=>x.error);if(errors.length)throw errors[0].error;
 const h=health.data??[];const insights:string[]=[];
 if(h.length>=2&&h[0].weight_kg!=null&&h[h.length-1].weight_kg!=null) insights.push(`Tu registro de peso tiene ${h.length} mediciones recientes; la tendencia actual es ${Number(h[0].weight_kg)<=Number(h[h.length-1].weight_kg)?"estable o descendente":"ascendente"}.`);
 if(h.some((x:any)=>x.sleep_hours!=null)) insights.push("La salud ya tiene datos de sueño que pueden cruzarse con hábitos y actividad.");
 if((goals.data??[]).some((x:any)=>Number(x.progress)<25)) insights.push("Tienes objetivos activos con progreso bajo; conviene revisar si siguen siendo prioritarios.");
 if((relations.data??[]).some((x:any)=>x.next_contact_on)) insights.push("Hay relaciones con seguimiento programable; el sistema puede recordarlas sin convertirlas en una agenda de contactos.");
 if((work.data??[]).length) insights.push(`Hay ${work.data.length} elementos de trabajo abiertos.`);
 if((learning.data??[]).length) insights.push(`Hay ${learning.data.length} elementos de aprendizaje activos.`);
 return {insights,health:h,goals:goals.data??[],learning:learning.data??[],relationships:relations.data??[],work:work.data??[],alarms:alarms.data??[]}; },
 async list<T>(table:TableName,order="created_at",ascending=false){
  const pageSize=1000;
  const singleton=table==="gamification_profiles";
  const orderColumn=singleton&&order==="created_at"?"updated_at":order;
  const rows:T[]=[];
  for(let from=0;;from+=pageSize){
   let query=db.from(table).select("*").order(orderColumn,{ascending});
   if(!singleton)query=query.order("id",{ascending:true});
   const {data,error}=await query.range(from,from+pageSize-1);
   if(error)throw error;
   const page=(data??[]) as T[];
   rows.push(...page);
   if(page.length<pageSize)break;
  }
  return rows;
 },
 async listLatest<T>(table:TableName,order="created_at",limit=100){
  const singleton=table==="gamification_profiles";
  const orderColumn=singleton&&order==="created_at"?"updated_at":order;
  const safeLimit=Math.max(1,Math.min(1000,Math.floor(limit)||100));
  let query=db.from(table).select("*").order(orderColumn,{ascending:false});
  if(!singleton)query=query.order("id",{ascending:false});
  const{data,error}=await query.limit(safeLimit);
  if(error)throw error;
  return (data??[]) as T[];
 },
 async byDate<T>(table:TableName,column:string,date:string){const {data,error}=await db.from(table).select("*").eq(column,date).order("created_at",{ascending:false});if(error)throw error;return (data??[]) as T[];},
 async create<T>(table:TableName,input:Record<string,unknown>){const {data,error}=await db.from(table).insert(input).select("*").single();if(error)throw error;return data as T;},
 async update<T>(table:TableName,id:string,patch:Record<string,unknown>){const {data,error}=await db.from(table).update(patch).eq("id",id).select("*").single();if(error)throw error;return data as T;},
 async remove(table:TableName,id:string){const {error}=await db.from(table).delete().eq("id",id);if(error)throw error;},
 async summary(){const tables:TableName[]=["shopping_items","learning_items","relationships","work_items","spiritual_entries","ai_insights"];const out=await Promise.all(tables.map(async table=>{const {count,error}=await db.from(table).select("id",{count:"exact",head:true});if(error)throw error;return [table,count??0] as const;}));return Object.fromEntries(out);},


 async deleteSleepSession(metricDate:string,sessionId:string){
  if(sleepDateTimeMinutes(metricDate,"00:00")===null||typeof sessionId!=="string"||!sessionId.trim())throw new Error("No se identificó correctamente la sesión que quieres eliminar.");
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw authError??new Error("No hay sesión activa");
  const {data:existing,error:readError}=await db.from("health_metrics").select("*").eq("user_id",user.id).eq("metric_date",metricDate).maybeSingle();
  if(readError)throw readError;
  if(!existing)throw new Error("No se encontró el registro de ese día. Actualiza el historial e inténtalo de nuevo.");
  const rawNotes=typeof existing.notes==="string"?existing.notes:"";
  let body:Record<string,unknown>={},userNotes=rawNotes,sleep:Record<string,any>={};
  if(rawNotes){
   try{
    const decoded=JSON.parse(rawNotes);
    if(decoded?.marker==="__POS_BODY_MEASURES__"){
     body=decoded.body&&typeof decoded.body==="object"?decoded.body:{};
     userNotes=typeof decoded.notes==="string"?decoded.notes:"";
     sleep=decoded.sleep&&typeof decoded.sleep==="object"?decoded.sleep:{};
    }
   }catch{}
  }
  const previous=normalizeStoredSleepSessions(sleep,metricDate);
  if(!previous.some(item=>item.id===sessionId))throw new Error("Esa sesión ya no está en el historial. Actualiza la lista.");
  const sessions=previous.filter(item=>item.id!==sessionId);
  const minutes=sessions.reduce((sum,item)=>{
   const start=sleepDateTimeMinutes(item.startDate,item.bedtime)??0;
   const end=sleepDateTimeMinutes(item.endDate,item.wakeTime)??start;
   return sum+Math.max(0,end-start);
  },0);
  const manual=Number(sleep.manualHours);
  const manualHours=Number.isFinite(manual)&&manual>0?manual:0;
  const totalHours=Math.round((minutes/60+manualHours)*100)/100;
  if(totalHours>24)throw new Error("El total de sueño restante supera las 24 horas. Revisa los periodos antes de continuar.");
  const nextSleep={
   ...sleep,
   bedtime:sessions[0]?.bedtime??null,
   wakeTime:sessions[0]?.wakeTime??null,
   manualHours:manualHours>0?manualHours:null,
   sessions,
  };
  const notes=JSON.stringify({marker:"__POS_BODY_MEASURES__",body,notes:userNotes,sleep:nextSleep});
  const {data,error}=await db.from("health_metrics").update({sleep_hours:totalHours>0?totalHours:null,notes})
   .eq("id",existing.id).eq("user_id",user.id).select("*").single();
  if(error)throw error;
  return data;
 },
 async appendSleepSessions(input:SleepSessionWrite[]){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw authError??new Error("No hay sesión activa");
  if(!Array.isArray(input)||input.length===0)throw new Error("Añade al menos una sesión de sueño.");
  const grouped=new Map<string,SleepSessionWrite[]>();
  for(const session of input){
   if(!session||typeof session.id!=="string"||!session.id||!["sleep","nap"].includes(session.kind))throw new Error("Hay una sesión con datos incompletos.");
   const start=sleepDateTimeMinutes(session.startDate,session.bedtime),end=sleepDateTimeMinutes(session.endDate,session.wakeTime);
   if(start===null||end===null||end<=start||end-start>24*60)throw new Error("Revisa las fechas y horas: cada periodo debe durar más de 0 y como máximo 24 horas.");
   const rows=grouped.get(session.startDate)??[];rows.push(session);grouped.set(session.startDate,rows);
  }
  const dates=Array.from(grouped.keys());
  const {data:existingRows,error:readError}=await db.from("health_metrics").select("*").eq("user_id",user.id).in("metric_date",dates);
  if(readError)throw readError;
  const existingByDate=new Map<string,any>();
  for(const row of existingRows??[])existingByDate.set(row.metric_date,row);
  const saved:any[]=[];
  for(const [metricDate,newSessions] of grouped){
   const existing=existingByDate.get(metricDate),rawNotes=typeof existing?.notes==="string"?existing.notes:"";
   let body:Record<string,unknown>={},userNotes=rawNotes,sleep:Record<string,any>={};
   if(rawNotes){try{const decoded=JSON.parse(rawNotes);if(decoded?.marker==="__POS_BODY_MEASURES__"){
    body=decoded.body&&typeof decoded.body==="object"?decoded.body:{};
    userNotes=typeof decoded.notes==="string"?decoded.notes:"";
    sleep=decoded.sleep&&typeof decoded.sleep==="object"?decoded.sleep:{};
   }}catch{}}
   const previous=normalizeStoredSleepSessions(sleep,metricDate),byId=new Map<string,SleepSessionWrite>();
   for(const item of previous)byId.set(item.id,item);
   for(const item of newSessions)byId.set(item.id,item);
   const sessions=Array.from(byId.values());
   const minutes=sessions.reduce((sum,item)=>{
    const a=sleepDateTimeMinutes(item.startDate,item.bedtime)??0,b=sleepDateTimeMinutes(item.endDate,item.wakeTime)??a;
    return sum+Math.max(0,b-a);
   },0);
   const manual=Number(sleep.manualHours),manualHours=Number.isFinite(manual)&&manual>0?manual:!previous.length&&existing?.sleep_hours!=null?Math.max(0,Number(existing.sleep_hours)||0):0;
   const totalHours=Math.round((minutes/60+manualHours)*100)/100;
   if(totalHours<=0||totalHours>24)throw new Error(`El total de sueño del ${metricDate} debe estar entre 0 y 24 horas.`);
   const first=sessions[0];
   const notes=JSON.stringify({marker:"__POS_BODY_MEASURES__",body,notes:userNotes,sleep:{
    ...sleep,bedtime:sleep.bedtime??first?.bedtime??null,wakeTime:sleep.wakeTime??first?.wakeTime??null,
    manualHours:manualHours>0?manualHours:null,sessions,
   }});
   if(existing?.id){
    const {data,error}=await db.from("health_metrics").update({sleep_hours:totalHours,notes}).eq("id",existing.id).eq("user_id",user.id).select("*").single();
    if(error)throw error;saved.push(data);
   }else{
    const {data,error}=await db.from("health_metrics").insert({user_id:user.id,metric_date:metricDate,sleep_hours:totalHours,notes}).select("*").single();
    if(error)throw error;saved.push(data);
   }
  }
  return saved;
 },
 async upsertHealth(input:Record<string,unknown>){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw authError??new Error("No hay sesión activa");
  const payload:Record<string,unknown>={...input,user_id:user.id};
  let {data,error}=await db.from("health_metrics").upsert(payload,{onConflict:"user_id,metric_date"}).select("*").single();
  if(!error)return data;
  if(!["PGRST204","42703"].includes(String(error.code??"")))throw error;
  const userId=user.id;const metricDate=payload["metric_date"];
  if(typeof userId!=="string"||typeof metricDate!=="string")throw error;
  const existingRead=await db.from("health_metrics").select("notes").eq("user_id",userId).eq("metric_date",metricDate).maybeSingle();
  if(existingRead.error)throw existingRead.error;
  const fallback={...payload};
  const bodyKeys=["neck_cm","shoulders_cm","chest_cm","waist_cm","left_arm_cm","right_arm_cm","hips_cm","left_thigh_cm","right_thigh_cm","left_calf_cm"];
  const marker="__POS_BODY_MEASURES__";
  let previousBody:Record<string,unknown>={};
  let previousSleep:Record<string,unknown>={};
  let previousNotes=typeof existingRead.data?.notes==="string"?existingRead.data.notes:"";
  if(previousNotes){
    try{
      const decoded=JSON.parse(previousNotes);
      if(decoded?.marker===marker){
        previousBody=decoded.body&&typeof decoded.body==="object"?decoded.body:{};
        previousSleep=decoded.sleep&&typeof decoded.sleep==="object"?decoded.sleep:{};
        previousNotes=typeof decoded.notes==="string"?decoded.notes:"";
      }
    }catch{}
  }
  const body=Object.fromEntries(bodyKeys.map(k=>[k,payload[k]!==undefined?payload[k]:(previousBody[k]??null)]));
  for(const k of bodyKeys)delete fallback[k];
  let userNotes=payload["notes"]!==undefined?(typeof payload["notes"]==="string"?String(payload["notes"]):""):previousNotes;
  let sleepToSave=previousSleep;
  if(typeof payload["notes"]==="string"){
    try{
      const incoming=JSON.parse(String(payload["notes"]));
      if(incoming?.marker===marker){
        userNotes=typeof incoming.notes==="string"?incoming.notes:"";
        if(incoming.sleep&&typeof incoming.sleep==="object")sleepToSave=incoming.sleep;
      }
    }catch{}
  }
  fallback["notes"]=JSON.stringify({marker,body,notes:userNotes,sleep:sleepToSave});
  const retry=await db.from("health_metrics").upsert(fallback,{onConflict:"user_id,metric_date"}).select("*").single();
  if(retry.error)throw retry.error;
  return retry.data;
 },

};