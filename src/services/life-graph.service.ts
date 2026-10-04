import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/date";
const db=supabase as any;
export type LGTable =
 "life_goals"|"routines"|"routine_logs"|"checklists"|"checklist_items"|"bucket_list"|
 "menstrual_profiles"|"menstrual_records"|"medical_appointments"|"nutrition_logs"|
 "learning_items"|"learning_notes"|"learning_sessions"|"language_profiles"|
 "relationships"|"relationship_interactions"|"work_items"|"work_sessions"|
 "spiritual_entries"|"finance_budgets"|"finance_debts"|"finance_savings_goals"|"finance_investments"|
 "finance_external_sources"|"finance_external_snapshots"|"life_events"|"notification_jobs"|
 "ai_runs"|"gamification_achievements"|"gamification_challenges";
async function uid(){const{data,error}=await supabase.auth.getUser();if(error||!data.user)throw error??new Error("No hay sesión activa");return data.user.id}
export const lifeGraphService={
 async list(table:LGTable,order="created_at",ascending=false){const{data,error}=await db.from(table).select("*").order(order,{ascending});if(error)throw error;return data??[]},
 async create(table:LGTable,input:Record<string,unknown>){const user_id=await uid();const{data,error}=await db.from(table).insert({...input,user_id}).select("*").single();if(error)throw error;return data},
 async update(table:LGTable,id:string,input:Record<string,unknown>){const{data,error}=await db.from(table).update(input).eq("id",id).select("*").single();if(error)throw error;return data},
 async remove(table:LGTable,id:string){const{error}=await db.from(table).delete().eq("id",id);if(error)throw error},
 async personalSnapshot(){
  const uidValue=await uid();
  const names=["life_goals","health_metrics","learning_items","language_profiles","relationships","relationship_interactions","work_items","finance_transactions","finance_budgets","finance_debts","finance_savings_goals","menstrual_records","medical_appointments","notification_jobs"];
  const entries=await Promise.all(names.map(async table=>{const q=table==="health_metrics"?db.from(table).select("metric_date,weight_kg,sleep_hours,exercise_minutes,water_liters").order("metric_date",{ascending:false}).limit(30):db.from(table).select("*").limit(50);const{data,error}=await q;return [table,error?[]:data??[]] as const}));
  return {user_id:uidValue,date:todayISO(),data:Object.fromEntries(entries)}
 },
 async advancedInsights(){
  const s=await this.personalSnapshot();const d=s.data as Record<string,any[]>,out:string[]=[];
  const weights=d.health_metrics?.filter(x=>x.weight_kg!=null).slice(0,2)??[];
  if(weights.length===2){const delta=Number(weights[0].weight_kg)-Number(weights[1].weight_kg);out.push(`Peso: ${delta===0?"sin cambio reciente":delta<0?`bajó ${Math.abs(delta).toFixed(1)} kg`:`subió ${delta.toFixed(1)} kg`} entre los dos últimos registros.`)}
  const low=d.life_goals?.filter(x=>x.status==="active"&&Number(x.progress)<50)??[]; if(low.length)out.push(`${low.length} objetivo(s) activo(s) están por debajo del 50% de progreso.`);
  const overdue=d.work_items?.filter(x=>x.status!=="done"&&x.target_date&&x.target_date<s.date)??[]; if(overdue.length)out.push(`${overdue.length} elemento(s) de trabajo están vencidos.`);
  const books=d.learning_items?.filter(x=>x.kind==="book")??[]; const booksSlow=books.filter(x=>x.total_pages&&Number(x.current_page)<Number(x.total_pages)*.5); if(booksSlow.length)out.push(`${booksSlow.length} libro(s) están por debajo del 50%; puedes programar una sesión de lectura.`);
  const langs=d.language_profiles?.filter(x=>x.active)??[]; if(langs.length>1)out.push(`Tienes ${langs.length} idiomas activos; conviene repartir las sesiones por habilidad y objetivo.`);
  const rel=d.relationships?.filter(x=>x.next_contact_on&&x.next_contact_on<=s.date)??[]; if(rel.length)out.push(`${rel.length} relación(es) tienen una interacción pendiente de seguimiento.`);
  const debt=d.finance_debts?.filter(x=>Number(x.balance)>0)??[]; if(debt.length)out.push(`Hay ${debt.length} deuda(s) con saldo pendiente; revisa pagos mínimos y fechas.`);
  const med=d.medical_appointments?.filter(x=>x.status==="scheduled"&&x.appointment_at>=new Date().toISOString()).length??0; if(med)out.push(`${med} cita(s) médica(s) próximas están conectadas al sistema de recordatorios.`);
  if(!out.length)out.push("Todavía no hay suficiente información cruzada para una señal prioritaria."); return {insights:out,snapshot:s};
 },
 async saveAiRun(kind:string,prompt:string,response:string,snapshot:unknown){return this.create("ai_runs",{kind,prompt,response,snapshot})},
 async importBackup(data:Record<string,unknown>,tables:string[]){const own=await uid();for(const table of tables){if(!Array.isArray(data[table])||!(data[table] as unknown[]).length)continue;const rows=(data[table] as Record<string,unknown>[]).map(r=>({...r,user_id:own}));const{error}=await db.from(table).upsert(rows,{onConflict:"id"});if(error)throw new Error("Importación falló en "+table+": "+error.message)}},
 async calculateNextPeriod(profileId:string,startDate:string,cycleDays:number){return {profile_id:profileId,start_date:startDate,cycle_length_days:cycleDays,next_period_on:addCalendarDays(startDate,cycleDays)}}
};
function addCalendarDays(iso:string,days:number){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
