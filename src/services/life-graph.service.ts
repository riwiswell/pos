import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/date";
const db=supabase as any;
export type LGTable =
 "life_goals"|"routines"|"routine_logs"|"checklists"|"checklist_items"|"bucket_list"|
 "menstrual_profiles"|"menstrual_records"|"medical_appointments"|"nutrition_logs"|
 "learning_items"|"learning_notes"|"learning_sessions"|"language_profiles"|
 "relationships"|"relationship_interactions"|"life_links"|"work_items"|"work_sessions"|
 "spiritual_entries"|"spiritual_goals"|"finance_budgets"|"finance_debts"|"finance_savings_goals"|"finance_investments"|
 "finance_external_sources"|"finance_external_snapshots"|"life_events"|"notification_jobs"|
 "ai_runs"|"gamification_profiles"|"gamification_xp_events"|"gamification_achievements"|"gamification_challenges";
async function uid(){const{data,error}=await supabase.auth.getUser();if(error||!data.user)throw error??new Error("No hay sesión activa");return data.user.id}
export const lifeGraphService={
 async list(table:LGTable,order="created_at",ascending=false){const{data,error}=await db.from(table).select("*").order(order,{ascending});if(error)throw error;return data??[]},
 async create(table:LGTable,input:Record<string,unknown>){const user_id=await uid();const{data,error}=await db.from(table).insert({...input,user_id}).select("*").single();if(error)throw error;return data},
 async update(table:LGTable,id:string,input:Record<string,unknown>){const{data,error}=await db.from(table).update(input).eq("id",id).select("*").single();if(error)throw error;return data},
 async remove(table:LGTable,id:string){const{error}=await db.from(table).delete().eq("id",id);if(error)throw error},
 async link(fromType:string,fromId:string,toType:string,toId:string,relation:string,metadata:Record<string,unknown>={}){return this.create("life_links",{from_type:fromType,from_id:fromId,to_type:toType,to_id:toId,relation,metadata})},
 async promoteJournalIdeaToProject(entryId:string){const user_id=await uid();const {data:entry,error:readError}=await db.from("journal_entries").select("id,title,content,type,entry_date").eq("id",entryId).single();if(readError)throw readError;if(entry.type!=="idea")throw new Error("Solo las ideas pueden convertirse en proyectos.");const title=(entry.title||"Idea sin título").trim();const {data:project,error}=await db.from("work_items").insert({user_id,title,kind:"project",status:"open",source_journal_entry_id:entry.id,notes:entry.content,target_date:null}).select("*").single();if(error)throw error;const {error:updateError}=await db.from("journal_entries").update({linked_work_item_id:project.id,capture_stage:"promoted"}).eq("id",entry.id);if(updateError)throw updateError;await this.link("journal_entry",entry.id,"work_item",project.id,"became_project",{entry_date:entry.entry_date});return project},
 async personalSnapshot(){
  const uidValue=await uid();
  const names=["life_goals","health_metrics","learning_items","language_profiles","relationships","relationship_interactions","work_items","work_sessions","life_links","finance_transactions","finance_budgets","finance_debts","finance_savings_goals","menstrual_records","medical_appointments","notification_jobs"];
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
  const activeWork=d.work_sessions?.find(x=>x.status==="active"&&x.started_at); if(activeWork){const mins=Math.max(0,Math.floor((Date.now()-new Date(activeWork.started_at).getTime())/60000));if(mins>=Number(activeWork.target_minutes||50))out.push(`Llevas ${mins} minutos en una sesión de trabajo activa. Tómate un descanso antes de continuar.`);else if(mins>=45)out.push(`Llevas ${mins} minutos trabajando en una sesión activa. Se aproxima una pausa.`);}
  const recentWork=d.work_sessions?.filter(x=>x.session_date===s.date&&x.status!=="active")??[];const totalMinutes=recentWork.reduce((a,x)=>a+Number(x.minutes||0),0);if(totalMinutes>=180)out.push(`Hoy acumulas ${totalMinutes} minutos de trabajo registrado. Revisa si el resto del día necesita recuperación o cambio de actividad.`);
  if(!out.length)out.push("Todavía no hay suficiente información cruzada para una señal prioritaria."); return {insights:out,snapshot:s};
 },
 async saveAiRun(kind:string,prompt:string,response:string,snapshot:unknown){return this.create("ai_runs",{kind,prompt,response,snapshot})},
 async importBackup(data:Record<string,unknown>,tables:string[]){const own=await uid();for(const table of tables){if(!Array.isArray(data[table])||!(data[table] as unknown[]).length)continue;const rows=(data[table] as Record<string,unknown>[]).map(r=>table==="profiles"?r:{...r,user_id:own});const{error}=await db.from(table).upsert(rows,{onConflict:"id"});if(error)throw new Error("Importación falló en "+table+": "+error.message)}},
 async calculateNextPeriod(profileId:string,startDate:string,cycleDays:number){return {profile_id:profileId,start_date:startDate,cycle_length_days:cycleDays,next_period_on:addCalendarDays(startDate,cycleDays)}}
};
function addCalendarDays(iso:string,days:number){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
