import { supabase } from "@/integrations/supabase/client";
type TableName="alarms"|"health_metrics"|"shopping_items"|"learning_items"|"relationships"|"work_items"|"spiritual_entries"|"ai_insights"|"gamification_profiles";
const db=supabase as any;
export const personalDomainsService={
 async list<T>(table:TableName,order="created_at",ascending=false){const {data,error}=await db.from(table).select("*").order(order,{ascending});if(error)throw error;return (data??[]) as T[];},
 async byDate<T>(table:TableName,column:string,date:string){const {data,error}=await db.from(table).select("*").eq(column,date).order("created_at",{ascending:false});if(error)throw error;return (data??[]) as T[];},
 async create<T>(table:TableName,input:Record<string,unknown>){const {data,error}=await db.from(table).insert(input).select("*").single();if(error)throw error;return data as T;},
 async update<T>(table:TableName,id:string,patch:Record<string,unknown>){const {data,error}=await db.from(table).update(patch).eq("id",id).select("*").single();if(error)throw error;return data as T;},
 async remove(table:TableName,id:string){const {error}=await db.from(table).delete().eq("id",id);if(error)throw error;},
 async summary(){const tables:TableName[]=["shopping_items","learning_items","relationships","work_items","spiritual_entries","ai_insights"];const out=await Promise.all(tables.map(async table=>{const {count,error}=await db.from(table).select("id",{count:"exact",head:true});if(error)throw error;return [table,count??0] as const;}));return Object.fromEntries(out);},
 async upsertHealth(input:Record<string,unknown>){const {data,error}=await db.from("health_metrics").upsert(input,{onConflict:"user_id,metric_date"}).select("*").single();if(error)throw error;return data;},
 async upsertGamification(user_id:string,xp:number){const level=Math.max(1,Math.floor(Math.sqrt(Math.max(0,xp)/100))+1);const {data,error}=await db.from("gamification_profiles").upsert({user_id,xp,level}).select("*").single();if(error)throw error;return data;}
};