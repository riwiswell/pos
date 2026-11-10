import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare,Flag,ListTodo,Plus,Trash2,GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Label } from "@/components/ui/label";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader"; import { ErrorState } from "@/components/common/States"; import { HelpTip } from "@/components/common/HelpTip"; import { RichTextEditor } from "@/components/common/RichTextEditor";
import { useGlobalDate } from "@/hooks/use-global-date"; import { useLGList,useLGMutations } from "@/hooks/use-life-graph"; import { useAuth } from "@/hooks/use-auth";
import { useHabits, useRecentLogs } from "@/hooks/use-habits";
import { usePersonalRecentList } from "@/hooks/use-personal-domains";
export const Route=createFileRoute("/_authenticated/vida")({component:LifePage});
type Tab="goals"|"routines"|"checklists"|"bucket"|"connections";
function LifePage(){const[tab,setTab]=useState<Tab>("goals");return <div className="space-y-5 pb-24"><GlobalDateHeader/><div><h1 className="flex items-center gap-2 text-xl font-semibold">Vida <HelpTip helpKey="life" /></h1><p className="text-sm text-muted-foreground">Metas, rutinas, listas, experiencias y conexiones entre tus áreas.</p></div><div className="flex flex-wrap gap-1.5">{([["goals","Metas",Flag],["routines","Rutinas",ListTodo],["checklists","Checklists",CheckSquare],["bucket","Bucket List",Flag],["connections","Conexiones",GitBranch]] as const).map(([id,label,I])=><button key={id} type="button" onClick={()=>setTab(id)} className={"rounded-full border px-3 py-1.5 text-xs "+(tab===id?"border-primary bg-primary/10":"border-border") }><I className="mr-1 inline h-3.5 w-3.5"/>{label}</button>)}</div>{tab==="goals"?<Goals/>:tab==="routines"?<Routines/>:tab==="checklists"?<Checklists/>:tab==="connections"?<Connections/>:<Bucket/>}</div>}

function Connections(){
 const goals=useLGList("life_goals");
 const routines=useLGList("routines");
 const work=useLGList("work_items");
 const learning=useLGList("learning_items");
 const relationships=useLGList("relationships");
 const spiritual=useLGList("spiritual_goals");
 const spiritualEntries=useLGList("spiritual_entries","entry_date");
 const routineLogs=useLGList("routine_logs","log_date");
 const workSessions=useLGList("work_sessions","session_date");
 const learningSessions=useLGList("learning_sessions","session_date");
 const learningNotes=useLGList("learning_notes");
 const relationshipInteractions=useLGList("relationship_interactions","interaction_on");
 const checklistItems=useLGList("checklist_items");
 const habits=useHabits(false);
 const habitLogs=useRecentLogs();
 const health=usePersonalRecentList<any>("health_metrics","metric_date",40);
 const diary=usePersonalRecentList<any>("journal_entries","entry_date",40);
 const links=useLGList("life_links");
 const mutations=useLGMutations("life_links");
 const [fromType,setFromType]=useState("life_goal");
 const [fromId,setFromId]=useState("");
 const [toType,setToType]=useState("work_item");
 const [toId,setToId]=useState("");
 const [relation,setRelation]=useState("supports_goal");
 const groups=useMemo(()=>[
  {type:"life_goal",label:"Meta",items:(goals.data??[]).map((x:any)=>({id:x.id,title:x.title}))},
  {type:"routine",label:"Rutina",items:(routines.data??[]).map((x:any)=>({id:x.id,title:x.title}))},
  {type:"work_item",label:"Proyecto o tarea",items:(work.data??[]).map((x:any)=>({id:x.id,title:x.title}))},
  {type:"learning_item",label:"Libro o aprendizaje",items:(learning.data??[]).map((x:any)=>({id:x.id,title:x.title}))},
  {type:"relationship",label:"Relación",items:(relationships.data??[]).map((x:any)=>({id:x.id,title:x.name}))},
  {type:"spiritual_goal",label:"Meta espiritual",items:(spiritual.data??[]).map((x:any)=>({id:x.id,title:x.title}))},
  {type:"spiritual_entry",label:"Registro espiritual",items:(spiritualEntries.data??[]).map((x:any)=>({id:x.id,title:x.title||"Reflexión · "+x.entry_date}))},
  {type:"routine_log",label:"Registro de rutina",items:(routineLogs.data??[]).map((x:any)=>({id:x.id,title:"Rutina · "+x.log_date+(x.completed?" · completada":"")}))},
  {type:"work_session",label:"Sesión de trabajo",items:(workSessions.data??[]).map((x:any)=>({id:x.id,title:"Trabajo · "+x.session_date+" · "+Number(x.minutes??0)+" min"}))},
  {type:"learning_session",label:"Sesión de aprendizaje",items:(learningSessions.data??[]).map((x:any)=>({id:x.id,title:"Estudio · "+x.session_date+" · "+Number(x.minutes??0)+" min"}))},
  {type:"learning_note",label:"Nota de aprendizaje",items:(learningNotes.data??[]).map((x:any)=>({id:x.id,title:x.title||x.section_label||"Nota de lectura"}))},
  {type:"relationship_interaction",label:"Interacción personal",items:(relationshipInteractions.data??[]).map((x:any)=>({id:x.id,title:"Interacción · "+x.interaction_on}))},
  {type:"checklist_item",label:"Elemento de checklist",items:(checklistItems.data??[]).map((x:any)=>({id:x.id,title:x.title}))},
  {type:"habit",label:"Hábito",items:(habits.data??[]).map((x:any)=>({id:x.id,title:x.name}))},
  {type:"habit_log",label:"Registro de hábito",items:(habitLogs.data??[]).map((x:any)=>({id:x.id,title:((habits.data??[]).find((h:any)=>h.id===x.habit_id)?.name||"Hábito")+" · "+x.date}))},
  {type:"health_metric",label:"Registro de Salud",items:(health.data??[]).map((x:any)=>({id:x.id,title:"Salud · "+x.metric_date}))},
  {type:"journal_entry",label:"Entrada del Diario",items:(diary.data??[]).map((x:any)=>({id:x.id,title:x.title||"Diario · "+x.entry_date}))},
 ],[goals.data,routines.data,work.data,learning.data,relationships.data,spiritual.data,spiritualEntries.data,routineLogs.data,workSessions.data,learningSessions.data,learningNotes.data,relationshipInteractions.data,checklistItems.data,habits.data,habitLogs.data,health.data,diary.data]);
 const fromGroup=groups.find(x=>x.type===fromType);
 const toGroup=groups.find(x=>x.type===toType);
 const fromRecords=fromGroup?.items??[];
 const toRecords=toGroup?.items??[];
 const resolve=(type:string,id:string)=>{
  const group=groups.find(x=>x.type===type);
  return group?.items.find(x=>x.id===id)?.title??"Registro vinculado";
 };
 const save=async()=>{
  if(!fromId||!toId||fromId===toId&&fromType===toType){toast.error("Selecciona dos registros diferentes.");return;}
  await mutations.create.mutateAsync({from_type:fromType,from_id:fromId,to_type:toType,to_id:toId,relation,metadata:{origin:"vida.connections"}});
  toast.success("Conexión guardada en el Life Graph.");
  setFromId("");setToId("");
 };
 const loading=goals.isLoading||routines.isLoading||work.isLoading||learning.isLoading||relationships.isLoading||spiritual.isLoading||spiritualEntries.isLoading||routineLogs.isLoading||workSessions.isLoading||learningSessions.isLoading||learningNotes.isLoading||relationshipInteractions.isLoading||checklistItems.isLoading||habits.isLoading||habitLogs.isLoading||health.isLoading||diary.isLoading;
 const failed=goals.isError||routines.isError||work.isError||learning.isError||relationships.isError||spiritual.isError||spiritualEntries.isError||routineLogs.isError||workSessions.isError||learningSessions.isError||learningNotes.isError||relationshipInteractions.isError||checklistItems.isError||habits.isError||habitLogs.isError||health.isError||diary.isError||links.isError;
 return <div className="space-y-4">
  <section className="glass space-y-3 rounded-2xl p-4">
   <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary"/><h2 className="font-semibold">Conectar áreas de tu vida</h2></div>
   <p className="text-sm text-muted-foreground">Relaciona registros que forman parte de una misma historia. La información sigue guardada en su módulo original; aquí solo creas el vínculo entre ellos.</p>
   {loading?<p className="text-sm text-muted-foreground">Cargando registros…</p>:failed?<ErrorState message="No se pudieron cargar todos los registros para crear conexiones."/>:
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
     <div className="space-y-2">
      <Label>Origen</Label>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fromType} onChange={e=>{setFromType(e.target.value);setFromId("");}}>
       {groups.map(group=><option key={group.type} value={group.type}>{group.label}</option>)}
      </select>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fromId} onChange={e=>setFromId(e.target.value)}>
       <option value="">Selecciona un registro…</option>
       {fromRecords.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
     </div>
     <div className="flex justify-center pb-1 text-primary"><GitBranch className="h-5 w-5 rotate-90 md:rotate-0"/></div>
     <div className="space-y-2">
      <Label>Destino</Label>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={toType} onChange={e=>{setToType(e.target.value);setToId("");}}>
       {groups.map(group=><option key={group.type} value={group.type}>{group.label}</option>)}
      </select>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={toId} onChange={e=>setToId(e.target.value)}>
       <option value="">Selecciona un registro…</option>
       {toRecords.filter(item=>fromType!==toType||item.id!==fromId).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
     </div>
     <div className="space-y-2 md:col-span-3 md:flex md:items-end md:gap-3">
      <div className="min-w-0 flex-1"><Label htmlFor="life-connection-relation">Tipo de conexión</Label><select id="life-connection-relation" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={relation} onChange={e=>setRelation(e.target.value)}><option value="supports_goal">Apoya esta meta</option><option value="depends_on">Depende de</option><option value="related_to">Está relacionado con</option><option value="inspires">Inspira</option><option value="measures_progress">Mide el progreso de</option><option value="belongs_to">Forma parte de</option></select></div>
      <Button disabled={!fromId||!toId||mutations.create.isPending} onClick={()=>void save()}>{mutations.create.isPending?"Conectando…":"Crear conexión"}</Button>
     </div>
    </div>
   }
  </section>
  <section className="glass space-y-3 rounded-2xl p-4">
   <div className="flex items-center justify-between"><h2 className="font-semibold">Tu red de conexiones</h2><span className="text-xs text-muted-foreground">{(links.data??[]).length} vínculos</span></div>
   {links.isError?<ErrorState message={links.error instanceof Error?links.error.message:"No se pudieron cargar las conexiones."}/>:!links.data?.length?<p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">Aún no has conectado registros. Cuando relaciones proyectos, metas, libros, rutinas o personas, el grafo irá formando una vista transversal de tu vida.</p>:
    <div className="space-y-2">{links.data.map((link:any)=><div key={link.id} className="flex items-center gap-3 rounded-xl border p-3">
     <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><GitBranch className="h-4 w-4"/></span>
     <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{resolve(link.from_type,link.from_id)}</p><p className="text-[11px] text-muted-foreground">{String(link.relation).replaceAll("_"," ")} → {resolve(link.to_type,link.to_id)}</p></div>
     <Button size="icon" variant="ghost" aria-label="Eliminar conexión" onClick={()=>void mutations.remove.mutateAsync(link.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
    </div>)}</div>
   }
  </section>
 </div>;
}

function Goals(){const q=useLGList("life_goals");const m=useLGMutations("life_goals");const{user}=useAuth();const[title,setTitle]=useState(""),[progress,setProgress]=useState("0"),[date,setDate]=useState(""),[notes,setNotes]=useState("");return <section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center gap-2"><h2 className="font-semibold">Metas</h2><HelpTip helpKey="life.goals"/></div>{q.isError&&<ErrorState message={q.error instanceof Error?q.error.message:"No se pudieron cargar las metas."}/>}<div className="grid gap-2 sm:grid-cols-4"><Input placeholder="Meta" value={title} onChange={e=>setTitle(e.target.value)}/><Input type="number" min="0" max="100" placeholder="Progreso %" value={progress} onChange={e=>setProgress(e.target.value)}/><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button disabled={!title.trim()} onClick={()=>{const value=Number(progress);if(!Number.isFinite(value)||value<0||value>100){toast.error("El progreso debe estar entre 0 y 100.");return}void m.create.mutateAsync({user_id:user?.id,title:title.trim(),progress:value,target_date:date||null,notes:notes||null}).then(()=>{setTitle("");setProgress("0");setDate("");setNotes("")})}}><Plus className="mr-1 h-4 w-4"/>Agregar</Button></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Notas de la meta, contexto, criterios de éxito…"/><div className="space-y-2">{(q.data??[]).map((x:any)=><div key={x.id} className="rounded-xl border p-3"><div className="flex gap-3"><div className="min-w-0 flex-1"><p className="font-medium">{x.title}</p><p className="text-xs text-muted-foreground">{Number(x.progress)||0}%{x.target_date?" · "+x.target_date:""}</p><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:Math.min(100,Math.max(0,Number(x.progress)||0))+"%"}}/></div></div><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div></div>)}</div></section>}
function Routines(){const q=useLGList("routines");const logs=useLGList("routine_logs","log_date");const m=useLGMutations("routines");const lm=useLGMutations("routine_logs");const{date}=useGlobalDate();const{user}=useAuth();const[title,setTitle]=useState(""),[freq,setFreq]=useState("daily"),[notes,setNotes]=useState("");const logByRoutine=useMemo(()=>new Map((logs.data||[]).filter((entry:any)=>entry.log_date===date).map((entry:any)=>[entry.routine_id,entry])),[logs.data,date]);return <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold">Rutinas</h2>{(q.isError||logs.isError)&&<ErrorState message={q.error instanceof Error?q.error.message:logs.error instanceof Error?logs.error.message:"No se pudieron cargar las rutinas y su historial."}/>}<div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"><Input placeholder="Rutina" value={title} onChange={e=>setTitle(e.target.value)}/><select className="h-10 rounded-md border bg-background px-3" value={freq} onChange={e=>setFreq(e.target.value)}><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="custom">Personalizada</option></select><Button disabled={!title.trim()} onClick={()=>void m.create.mutateAsync({user_id:user?.id,title:title.trim(),frequency_rule:freq,notes:notes||null}).then(()=>{setTitle("");setNotes("")})}><Plus className="mr-1 h-4 w-4"/>Agregar</Button></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Qué incluye esta rutina…"/>{(q.data??[]).map((x:any)=><div key={x.id} className="flex items-center gap-2 rounded-xl border p-3"><button type="button" className={"rounded-full border px-3 py-1 text-xs "+(logByRoutine.get(x.id)?.completed?"border-primary bg-primary/10 text-primary":"")} onClick={()=>{const entry:any=logByRoutine.get(x.id);if(entry){void lm.update.mutate({id:entry.id,patch:{completed:!entry.completed}})}else{void lm.create.mutate({user_id:user?.id,routine_id:x.id,log_date:date,completed:true})}}}>{logByRoutine.get(x.id)?.completed?"Completada hoy":"Marcar hoy"}</button><p className="min-w-0 flex-1"><span className="font-medium">{x.title}</span><span className="ml-2 text-xs text-muted-foreground">{x.frequency_rule}</span></p><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</section>}
function Checklists(){const q=useLGList("checklists");const m=useLGMutations("checklists");const{user}=useAuth();const[title,setTitle]=useState(""),[notes,setNotes]=useState("");return <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold">Checklists</h2>{q.isError&&<ErrorState message={q.error instanceof Error?q.error.message:"No se pudieron cargar las listas de verificación."}/>}<div className="flex gap-2"><Input className="flex-1" placeholder="Nombre de checklist" value={title} onChange={e=>setTitle(e.target.value)}/><Button disabled={!title.trim()} onClick={()=>void m.create.mutateAsync({user_id:user?.id,title:title.trim(),notes:notes||null}).then(()=>{setTitle("");setNotes("")})}><Plus className="mr-1 h-4 w-4"/>Crear</Button></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Contexto o instrucciones…"/>{(q.data??[]).map((x:any)=><div key={x.id} className="flex items-center gap-2 rounded-xl border p-3"><CheckSquare className="h-4 w-4"/><span className="flex-1 font-medium">{x.title}</span><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</section>}
function Bucket(){const q=useLGList("bucket_list");const m=useLGMutations("bucket_list");const{user}=useAuth();const[title,setTitle]=useState(""),[date,setDate]=useState(""),[notes,setNotes]=useState("");return <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold">Bucket List</h2>{q.isError&&<ErrorState message={q.error instanceof Error?q.error.message:"No se pudo cargar la lista de experiencias."}/>}<div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"><Input placeholder="Quiero hacer / vivir…" value={title} onChange={e=>setTitle(e.target.value)}/><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button disabled={!title.trim()} onClick={()=>void m.create.mutateAsync({user_id:user?.id,title:title.trim(),target_date:date||null,notes:notes||null}).then(()=>{setTitle("");setDate("");setNotes("")})}><Plus className="mr-1 h-4 w-4"/>Agregar</Button></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Por qué importa, preparación, recuerdos…"/>{(q.data??[]).map((x:any)=><div key={x.id} className="flex items-center gap-2 rounded-xl border p-3"><span className="flex-1"><span className="font-medium">{x.title}</span>{x.target_date&&<span className="ml-2 text-xs text-muted-foreground">{x.target_date}</span>}</span><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</section>}
