import { supabase } from "@/integrations/supabase/client";
type TableName="alarms"|"health_metrics"|"shopping_items"|"learning_items"|"relationships"|"work_items"|"spiritual_entries"|"ai_insights"|"gamification_profiles"|"shopping_lists";
const db=supabase as any;
export const personalDomainsService={
 async personalInsights(){const [health,goals,learning,relations,work,alarms]=await Promise.all([
  db.from("health_metrics").select("metric_date,weight_kg,sleep_hours,exercise_minutes,water_liters").order("metric_date",{ascending:false}).limit(14),
  db.from("life_goals").select("title,progress,status,target_date").eq("status","active").limit(20),
  db.from("learning_items").select("title,kind,progress,status").eq("status","active").limit(20),
  db.from("relationships").select("name,last_contact_on,next_contact_on,relationship_type").limit(20),
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
 async list<T>(table:TableName,order="created_at",ascending=false){const {data,error}=await db.from(table).select("*").order(order,{ascending});if(error)throw error;return (data??[]) as T[];},
 async byDate<T>(table:TableName,column:string,date:string){const {data,error}=await db.from(table).select("*").eq(column,date).order("created_at",{ascending:false});if(error)throw error;return (data??[]) as T[];},
 async create<T>(table:TableName,input:Record<string,unknown>){const {data,error}=await db.from(table).insert(input).select("*").single();if(error)throw error;return data as T;},
 async update<T>(table:TableName,id:string,patch:Record<string,unknown>){const {data,error}=await db.from(table).update(patch).eq("id",id).select("*").single();if(error)throw error;return data as T;},
 async remove(table:TableName,id:string){const {error}=await db.from(table).delete().eq("id",id);if(error)throw error;},
 async summary(){const tables:TableName[]=["shopping_items","learning_items","relationships","work_items","spiritual_entries","ai_insights"];const out=await Promise.all(tables.map(async table=>{const {count,error}=await db.from(table).select("id",{count:"exact",head:true});if(error)throw error;return [table,count??0] as const;}));return Object.fromEntries(out);},
 async createShoppingItem(user_id:string,input:{name:string;note?:string|null}){let {data:list,error}=await db.from("shopping_lists").select("id").eq("user_id",user_id).order("position").limit(1).maybeSingle();if(error)throw error;if(!list){const created=await db.from("shopping_lists").insert({user_id,name:"Mercado",position:0}).select("id").single();if(created.error)throw created.error;list=created.data;}const created=await db.from("shopping_items").insert({user_id,list_id:list.id,name:input.name,checked:false,position:0,note:input.note??null}).select("*").single();if(created.error)throw created.error;return created.data;},
 async upsertHealth(input:Record<string,unknown>){let {data,error}=await db.from("health_metrics").upsert(input,{onConflict:"user_id,metric_date"}).select("*").single();if(!error)return data;const fallback={...input};const bodyKeys=["neck_cm","shoulders_cm","chest_cm","waist_cm","left_arm_cm","right_arm_cm","hips_cm","left_thigh_cm","right_thigh_cm","left_calf_cm","right_calf_cm"];const body=Object.fromEntries(bodyKeys.map(k=>[k,input[k]??null]));for(const k of bodyKeys)delete fallback[k];const userNotes=typeof input.notes==="string"?input.notes:"";const marker="__POS_BODY_MEASURES__";const legacyNotes=JSON.stringify({marker,body,notes:userNotes});fallback.notes=legacyNotes;const retry=await db.from("health_metrics").upsert(fallback,{onConflict:"user_id,metric_date"}).select("*").single();if(retry.error)throw error;return retry.data;},
 async upsertGamification(user_id:string,xp:number){const level=Math.max(1,Math.floor(Math.sqrt(Math.max(0,xp)/100))+1);const {data,error}=await db.from("gamification_profiles").upsert({user_id,xp,level}).select("*").single();if(error)throw error;return data;}
};