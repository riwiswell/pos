import { useEffect,useMemo,useRef,useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CalendarHeart,ClipboardList,Coffee,HeartPulse,Pencil,Pill,Plus,Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Label } from "@/components/ui/label"; import { Switch } from "@/components/ui/switch";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader"; import { toast } from "sonner"; import { HelpTip } from "@/components/common/HelpTip"; import { RichTextEditor } from "@/components/common/RichTextEditor"; import { HealthMetricsPanel } from "@/components/health/HealthMetricsPanel"; import { SleepPanel } from "@/components/health/SleepPanel"; import { MedicationDialog } from "@/components/health/MedicationDialog";
import { useGlobalDate } from "@/hooks/use-global-date";
import { todayISO } from "@/lib/date";
import { subscribeToBackgroundPush } from "@/services/push.service"; import { useAuth } from "@/hooks/use-auth"; import { usePersonalDateList } from "@/hooks/use-personal-domains"; import { useProfile, useProfileMutations } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client"; import { useLGList,useLGMutations } from "@/hooks/use-life-graph"; import { lastWater,useDoseHistory,useDoses,useMedicationMutations,useMedications,useTakenCounts } from "@/hooks/use-medications"; import { formatTime12,medicationScheduleLabel,formatStockQuantity,formatGlasses,formatWaterGlassOption,waterGlassesToMl,WATER_GLASS_ML,medicationWater,remainingQuantity,durationDays,WATER_OPTIONS,type BeverageType,type HydrationEntry,type Medication } from "@/domain/health";
import { useHydrationEntries,useHydrationMutations } from "@/hooks/use-hydration";
import { useMedicationStockTotals } from "@/hooks/use-medications";
export const Route=createFileRoute("/_authenticated/salud")({component:HealthPage});
function HealthPage(){
 const[tab,setTab]=useState("meds");
 const search=useRouterState({select:(state)=>state.location.search as Record<string,unknown>});
 // Push-action links must mount the medication panel; the panel owns the single
 // authenticated mutation and clears the search state through the router.
 useEffect(()=>{
  if(typeof search["dose"]==="string"&&(search["action"]==="take"||search["action"]==="snooze"))setTab("meds");
 },[search["dose"],search["action"]]);
 const{data:profile}=useProfile();const hidden=profile?.hidden_features||{};const tabs=[["meds","Medicamentos",false],["sleep","Sueño",false],["metrics","Medidas del cuerpo",false],["cycle","Ciclo",hidden["health.cycle"]===true],["appointments","Citas",hidden["health.appointments"]===true],["nutrition","Nutrición",hidden["health.nutrition"]===true]].filter((x:any)=>!x[2]);const current=tabs.some((x:any)=>x[0]===tab)?tab:tabs[0]?.[0]||"meds";return <div className="space-y-5 pb-24"><GlobalDateHeader/><div><h1 className="flex items-center gap-2 text-xl font-semibold">Salud <HelpTip helpKey="health" /></h1><p className="text-sm text-muted-foreground">Medicamentos, sueño, medidas, signos vitales y seguimiento diario.</p></div><HydrationCard/><div className="flex flex-wrap gap-1.5">{tabs.map(([k,v])=><button key={k as string} onClick={()=>setTab(k as string)} className={"rounded-full border px-3 py-1.5 text-xs "+(current===k?"border-primary bg-primary/10":"border-border")}>{v as string}</button>)}</div>{current==="meds"?<Medications/>:current==="sleep"?<SleepPanel/>:current==="metrics"?<HealthMetricsPanel/>:current==="cycle"?<Cycle/>:current==="appointments"?<Appointments/>:<Nutrition/>}</div>}
type HydrationConfig = { enabled: boolean; start_time: string; end_time: string; interval_minutes: number; amount_ml: number; background_push?: boolean };
const DEFAULT_HYDRATION: HydrationConfig = { enabled: true, start_time: "08:00", end_time: "21:30", interval_minutes: 90, amount_ml: WATER_GLASS_ML };

function normalizeHydrationTime(value: unknown): string | null {
 const match=String(value??"").trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d(?:\\.\d+)?)?$/);
 if(!match)return null;
 const hour=Number(match[1]);
 if(!Number.isInteger(hour)||hour<0||hour>23)return null;
 return String(hour).padStart(2,"0")+":"+match[2];
}
function hydrationMinutes(value: string): number {
 const [hour,minute]=value.split(":").map(Number);
 return hour*60+minute;
}

function HydrationCard(){
 const{date}=useGlobalDate();
 const yesterdayDate=useMemo(()=>{const d=new Date(date+"T12:00:00");d.setDate(d.getDate()-1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")},[date]);
 const metrics=usePersonalDateList<any>("health_metrics","metric_date",date);
 const yesterdayMetrics=usePersonalDateList<any>("health_metrics","metric_date",yesterdayDate);
 const doses=useDoses(date);
 const entries=useHydrationEntries(date);
 const yesterdayEntries=useHydrationEntries(yesterdayDate);
 const hydration=useHydrationMutations(date);
 const profileQuery=useProfile();const profile=profileQuery.data;const profileMutations=useProfileMutations();
 const [customMl,setCustomMl]=useState("300");
 const [otherType,setOtherType]=useState<BeverageType>("tea");
 const [otherMl,setOtherMl]=useState("150");
 const [otherName,setOtherName]=useState("");
 const [editingEntryId,setEditingEntryId]=useState<string|null>(null);
 const [editType,setEditType]=useState<BeverageType>("water");
 const [editMl,setEditMl]=useState("325");
 const [editName,setEditName]=useState("");
 const [editTime,setEditTime]=useState("08:00");
 const [confirmDeleteId,setConfirmDeleteId]=useState<string|null>(null);
 const [schedule,setSchedule]=useState<HydrationConfig>(DEFAULT_HYDRATION);
 const [savingSchedule,setSavingSchedule]=useState(false);
 const [pushBusy,setPushBusy]=useState(false);
 useEffect(()=>{
  if(!profile)return;
  const saved={...DEFAULT_HYDRATION,...(profile.notification_preferences?.hydration??{})};
  setSchedule({
   ...saved,
   start_time:normalizeHydrationTime(saved.start_time)??DEFAULT_HYDRATION.start_time,
   end_time:normalizeHydrationTime(saved.end_time)??DEFAULT_HYDRATION.end_time,
  });
 },[profile]);
 const legacyWaterMl=Math.max(0,Math.round((Number(metrics.data?.[0]?.water_liters??0)||0)*1000));
 const dayEntries=entries.data??[];
 const recordedWaterMl=dayEntries.filter(x=>x.beverage_type==="water").reduce((sum,x)=>sum+Number(x.amount_ml||0),0);
 const otherFluidMl=dayEntries.filter(x=>x.beverage_type!=="water").reduce((sum,x)=>sum+Number(x.amount_ml||0),0);
 const legacyYesterdayWaterMl=Math.max(0,Math.round((Number(yesterdayMetrics.data?.[0]?.water_liters??0)||0)*1000));
 const yesterdayWaterMl=legacyYesterdayWaterMl+(yesterdayEntries.data??[]).filter(x=>x.beverage_type==="water").reduce((sum,x)=>sum+Number(x.amount_ml||0),0);
 const medicineWaterMl=waterGlassesToMl(medicationWater(doses.data??[]));
 const waterMl=legacyWaterMl+recordedWaterMl+medicineWaterMl;
 const totalFluidMl=waterMl+otherFluidMl;
 const fmt=(value:number)=>Math.round(value).toLocaleString("es-CO");
 const busy=hydration.create.isPending||hydration.update.isPending||hydration.remove.isPending;
 const beverageLabels:Record<BeverageType,string>={water:"Agua",coffee:"Café",tea:"Té",milk:"Leche",other:"Otra bebida"};
 const addDrink=async(beverage_type:BeverageType,amount_ml:number,note?:string|null)=>{
  if(!Number.isInteger(amount_ml)||amount_ml<1||amount_ml>3000)return;
  if(beverage_type==="other"&&!note?.trim()){toast.error("Escribe el nombre de la bebida (por ejemplo, aguapanela o Frutiño).");return;}
  await hydration.create.mutateAsync({beverage_type,amount_ml,note});
  if(beverage_type==="other")setOtherName("");
 };
 const startEditing=(entry:HydrationEntry)=>{
  const consumedAt=new Date(entry.consumed_at);
  setEditingEntryId(entry.id);
  setEditType(entry.beverage_type);
  setEditMl(String(entry.amount_ml));
  setEditName(entry.note??"");
  setEditTime(Number.isNaN(consumedAt.getTime())?"08:00":String(consumedAt.getHours()).padStart(2,"0")+":"+String(consumedAt.getMinutes()).padStart(2,"0"));
  setConfirmDeleteId(null);
 };
 const saveEntry=async()=>{
  if(!editingEntryId)return;
  const amount=Number(editMl);
  if(!Number.isInteger(amount)||amount<1||amount>3000){toast.error("Introduce una cantidad entre 1 y 3000 ml.");return;}
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(editTime)){toast.error("Introduce una hora válida.");return;}
  if(editType==="other"&&!editName.trim()){toast.error("Escribe el nombre de la bebida.");return;}
  try{
   await hydration.update.mutateAsync({id:editingEntryId,beverage_type:editType,amount_ml:amount,note:editType==="other"?editName.trim():null,consumed_time:editTime});
   setEditingEntryId(null);
  }catch{}
 };
 const deleteEntry=async(id:string)=>{
  try{await hydration.remove.mutateAsync(id);setConfirmDeleteId(null);setEditingEntryId(null);}catch{}
 };
 const saveSchedule=async()=>{
  if(!profile||savingSchedule)return;
  const startTime=normalizeHydrationTime(schedule.start_time);
  const endTime=normalizeHydrationTime(schedule.end_time);
  if(!startTime||!endTime){
   toast.error("Introduce horas válidas, por ejemplo 09:40 y 23:30.");return;
  }
  if(hydrationMinutes(endTime)<=hydrationMinutes(startTime)){
   toast.error("La hora final debe ser posterior a la hora inicial.");return;
  }
  const normalizedSchedule={...schedule,start_time:startTime,end_time:endTime};
  setSchedule(normalizedSchedule);
  setSavingSchedule(true);
  try{
   const preferences={...(profile.notification_preferences||{}),hydration:normalizedSchedule};
   await profileMutations.save.mutateAsync({notification_preferences:preferences});
   const{data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Inicia sesión de nuevo para sincronizar los avisos.");
   const response=await fetch("/api/hydration-preferences",{
    method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify(normalizedSchedule),
   });
   const result=await response.json() as {error?:string;scheduled?:number;pushRequired?:boolean;enabled?:boolean};
   if(!response.ok)throw new Error(result.error||"No se pudieron sincronizar los avisos.");
   if(!normalizedSchedule.enabled)toast.success("Recordatorios de hidratación desactivados.");
   else if(result.pushRequired)toast.info("Avisos locales activos mientras POS esté abierto. Activa las notificaciones push para recibirlos con POS cerrado.");
   else toast.success("Recordatorios en segundo plano programados.");
  }catch(error){toast.error(error instanceof Error?error.message:"No se pudieron guardar los recordatorios.");}
  finally{setSavingSchedule(false);}
 };
 const activatePush=async()=>{
  setPushBusy(true);
  try{
   const result=await subscribeToBackgroundPush();
   if(result==="subscribed")toast.success("Notificaciones en segundo plano activadas.");
   else if(result==="missing-key")toast.error("Falta configurar VAPID en Cloudflare; POS mantendrá los avisos locales mientras esté abierto.");
   else if(result==="permission-denied")toast.error("Permite las notificaciones del navegador para continuar.");
   else if(result==="unsupported")toast.error("Este navegador no admite notificaciones push.");
   else toast.error("No se pudo activar la suscripción de notificaciones.");
  }catch(error){toast.error(error instanceof Error?error.message:"No se pudieron activar las notificaciones.");}
  finally{setPushBusy(false);}
 };
 const disabled=busy||entries.isLoading;
 const reminderWaterOptions=WATER_OPTIONS.filter(glasses=>glasses>0).map(glasses=>({glasses,amount_ml:Math.round(waterGlassesToMl(glasses))}));
 return <section className="glass space-y-4 rounded-2xl p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="flex items-center gap-1 font-semibold">💧 Hidratación <HelpTip helpKey="hydration.daily" /></h2><p className="text-xs text-muted-foreground">Agua simple y otras bebidas se registran por separado.</p></div>
   <div className="text-right"><p className="text-sm font-semibold tabular-nums">{(waterMl/1000).toLocaleString("es-CO",{maximumFractionDigits:2})} / 2,25 L</p><p className="text-[11px] text-muted-foreground">agua simple</p></div>
  </div>
  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500 transition-all" style={{width:Math.min(100,Math.max(0,waterMl/2250*100))+"%"}}/></div>
  <div className="flex flex-wrap gap-2 text-xs">
   <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-700 dark:text-sky-300">Agua: {fmt(waterMl)} ml</span>
   <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:text-amber-300">Café y otras bebidas: {fmt(otherFluidMl)} ml</span>
   <span className="rounded-full bg-muted px-2.5 py-1 text-foreground">Líquidos registrados: {fmt(totalFluidMl)} ml</span>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   {WATER_OPTIONS.filter(glasses=>glasses>0).map(glasses=>{const ml=Math.round(waterGlassesToMl(glasses));return <Button key={glasses} size="sm" variant={glasses===1?"default":"outline"} disabled={disabled} onClick={()=>void addDrink("water",ml)}>+{formatWaterGlassOption(glasses)} agua</Button>})}
   <Button size="sm" variant="outline" className="gap-1" disabled={disabled} onClick={()=>void addDrink("coffee",100)}><Coffee className="h-3.5 w-3.5"/> +100 ml café</Button>
  </div>
  <div className="space-y-2">
   <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2">
    <select aria-label="Tipo de bebida" className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={otherType} onChange={e=>setOtherType(e.target.value as BeverageType)}>
     <option value="coffee">Café</option><option value="tea">Té</option><option value="milk">Leche</option><option value="other">Otra bebida</option>
    </select>
    <Input aria-label="Cantidad en mililitros" className="h-9" type="number" min="1" max="3000" step="25" value={otherMl} onChange={e=>setOtherMl(e.target.value)}/>
    <Button size="sm" variant="outline" disabled={disabled||!Number.isInteger(Number(otherMl))||Number(otherMl)<1||Number(otherMl)>3000||(otherType==="other"&&!otherName.trim())} onClick={()=>void addDrink(otherType,Number(otherMl),otherType==="other"?otherName.trim():null)}>Registrar</Button>
   </div>
   {otherType==="other"&&<Input aria-label="Nombre de la bebida" className="h-9" placeholder="Nombre (aguapanela, Frutiño, jugo…)" value={otherName} onChange={e=>setOtherName(e.target.value)} maxLength={80}/>}
  </div>
  <div className="space-y-2 rounded-xl border p-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm font-semibold">{date===todayISO()?"Lo que has tomado hoy":"Bebidas registradas ese día"}</p>
    <span className="text-xs text-muted-foreground">{dayEntries.length} {dayEntries.length===1?"registro":"registros"}</span>
   </div>
   {entries.isLoading?<p className="text-xs text-muted-foreground">Cargando registros…</p>:dayEntries.length===0?<p className="text-xs text-muted-foreground">Todavía no hay bebidas individuales registradas para esta fecha.</p>:<div className="space-y-2">
    {dayEntries.map(entry=>{
     const label=entry.beverage_type==="other"?(entry.note?.trim()||"Otra bebida"):beverageLabels[entry.beverage_type];
     const timeLabel=new Date(entry.consumed_at).toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"});
     return <div key={entry.id} className="rounded-lg border border-border/70 p-2.5">
      {editingEntryId===entry.id?<div className="space-y-2">
       <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select aria-label="Tipo de bebida al editar" className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={editType} onChange={e=>setEditType(e.target.value as BeverageType)}>
         <option value="water">Agua</option><option value="coffee">Café</option><option value="tea">Té</option><option value="milk">Leche</option><option value="other">Otra bebida</option>
        </select>
        <Input aria-label="Cantidad en mililitros al editar" className="h-9" type="number" min="1" max="3000" step="25" value={editMl} onChange={e=>setEditMl(e.target.value)}/>
        <Input aria-label="Hora del registro" className="h-9" type="time" value={editTime} onChange={e=>setEditTime(e.target.value)}/>
        {editType==="other"&&<Input aria-label="Nombre de la bebida al editar" className="h-9" placeholder="Nombre de la bebida" value={editName} onChange={e=>setEditName(e.target.value)} maxLength={80}/>}
       </div>
       <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={()=>setEditingEntryId(null)}>Cancelar</Button>
        <Button type="button" size="sm" disabled={hydration.update.isPending} onClick={()=>void saveEntry()}>{hydration.update.isPending?"Guardando…":"Guardar cambios"}</Button>
       </div>
      </div>:<div className="flex flex-wrap items-center gap-2">
       <span className="min-w-0 flex-1"><b className="text-sm">{label}</b><span className="ml-2 text-xs text-muted-foreground">{timeLabel}</span></span>
       <span className="text-sm font-medium tabular-nums">{fmt(entry.amount_ml)} ml</span>
       <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={"Editar "+label} title="Editar registro" onClick={()=>startEditing(entry)}><Pencil className="h-4 w-4"/></Button>
       {confirmDeleteId===entry.id?<div className="flex items-center gap-1"><Button type="button" size="sm" variant="destructive" disabled={hydration.remove.isPending} onClick={()=>void deleteEntry(entry.id)}>Eliminar</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setConfirmDeleteId(null)}>Cancelar</Button></div>:<Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={"Eliminar "+label} title="Eliminar registro" onClick={()=>{setConfirmDeleteId(entry.id);setEditingEntryId(null);}}><Trash2 className="h-4 w-4"/></Button>}
      </div>}
     </div>;
    })}
   </div>}
   <p className="text-[11px] text-muted-foreground">Puedes corregir el tipo, nombre, cantidad y hora de cada bebida, o eliminar un registro incorrecto.</p>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">Ayer ({yesterdayDate}): {yesterdayEntries.isLoading?"cargando…":yesterdayEntries.isError?"sin conexión al historial":fmt(yesterdayWaterMl)+" ml de agua"}</span>{(entries.isError||yesterdayEntries.isError)&&<Button type="button" size="sm" variant="outline" className="h-7" onClick={()=>{void entries.refetch();void yesterdayEntries.refetch()}}>Reintentar carga</Button>}</div>
  {entries.isError&&<p className="text-xs text-destructive">No se pudo cargar el registro de bebidas. Puedes intentar registrar de todas formas; el error no bloquea el formulario. Detalle: {entries.error instanceof Error?entries.error.message:"error desconocido"}</p>}
  <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[.04] p-3 space-y-3">
   <div className="flex items-center justify-between gap-3">
    <div><p className="text-sm font-semibold">Avisos para tomar agua</p><p className="text-xs text-muted-foreground">Recordatorios automáticos; no crean un hábito duplicado.</p></div>
    <Switch checked={schedule.enabled} onCheckedChange={enabled=>setSchedule(current=>({...current,enabled}))}/>
   </div>
   {schedule.enabled&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <label className="space-y-1 text-xs text-muted-foreground">Desde<Input type="time" value={schedule.start_time} onChange={e=>setSchedule(current=>({...current,start_time:e.target.value}))}/></label>
    <label className="space-y-1 text-xs text-muted-foreground">Hasta<Input type="time" value={schedule.end_time} onChange={e=>setSchedule(current=>({...current,end_time:e.target.value}))}/></label>
    <label className="space-y-1 text-xs text-muted-foreground">Cada<select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={schedule.interval_minutes} onChange={e=>setSchedule(current=>({...current,interval_minutes:Number(e.target.value)}))}>{[30,45,60,90,120,180].map(value=><option key={value} value={value}>{value} min</option>)}</select></label>
    <label className="space-y-1 text-xs text-muted-foreground">Cantidad<select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={schedule.amount_ml} onChange={e=>setSchedule(current=>({...current,amount_ml:Number(e.target.value)}))}>{!reminderWaterOptions.some(option=>option.amount_ml===schedule.amount_ml)&&<option value={schedule.amount_ml}>{schedule.amount_ml} ml · valor guardado</option>}{reminderWaterOptions.map(({glasses,amount_ml})=><option key={glasses} value={amount_ml}>{formatWaterGlassOption(glasses)}</option>)}</select></label>
   </div>}
   <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" disabled={savingSchedule||profileQuery.isLoading} onClick={()=>void saveSchedule()}>{savingSchedule?"Guardando…":"Guardar avisos"}</Button>
    <Button size="sm" variant="outline" disabled={pushBusy} onClick={()=>void activatePush()}>{pushBusy?"Activando…":"Activar avisos en segundo plano"}</Button>
    <Link to="/perfil" search={(prev:Record<string,unknown>)=>prev} className="text-xs text-primary hover:underline">Configuración completa</Link>
   </div>
   <p className="text-[11px] text-muted-foreground">{schedule.background_push?"Push confirmado: los avisos pueden llegar con POS cerrado.":"Avisos locales: aparecen mientras Personal OS está abierto. Activa push para recibirlos con el navegador cerrado."}</p>
  </div>
  <p className="text-xs text-muted-foreground">El agua asociada a medicamentos también suma al total de agua simple, pero se corrige desde la toma del medicamento. Los registros antiguos agregados siguen visibles en el total; esta lista permite editar los registros individuales de bebidas.</p>
 </section>;
}

function Medications(){const{date}=useGlobalDate();const meds=useMedications();const doses=useDoses(date);const taken=useTakenCounts();const stock=useMedicationStockTotals();const m=useMedicationMutations();const[restockInputs,setRestockInputs]=useState<Record<string,string>>({});const[showPaused,setShowPaused]=useState(false);const medicationList=meds.data??[];const displayedMeds=medicationList.filter((item:any)=>showPaused||item.active);const pausedCount=medicationList.filter((item:any)=>!item.active).length;const[historyDays,setHistoryDays]=useState(90);const[historyPage,setHistoryPage]=useState(0);const historyFrom=useMemo(()=>{const d=new Date(date+"T12:00:00");d.setDate(d.getDate()-historyDays+1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")},[date,historyDays]);useEffect(()=>setHistoryPage(0),[date,historyFrom]);const history=useDoseHistory(historyFrom,date,historyPage,50);const historyRows=history.data?.rows??[];const historyTotal=history.data?.total??0;const historyPageCount=Math.max(1,Math.ceil(historyTotal/50));const[open,setOpen]=useState(false);const[editing,setEditing]=useState<Medication|null>(null);const[waterByDose,setWaterByDose]=useState<Record<string,number>>({});const[actualTimes,setActualTimes]=useState<Record<string,string>>({});useEffect(()=>{setActualTimes(current=>{const next={...current};for(const dose of doses.data||[]){if(!(dose.id in next)){const taken=dose.taken_at?new Date(dose.taken_at):null;next[dose.id]=taken?String(taken.getHours()).padStart(2,"0")+":"+String(taken.getMinutes()).padStart(2,"0"):""}}return next})},[doses.data]);const todayDoses=doses.data||[];const activeTodayDoses=todayDoses.filter((d:any)=>(meds.data||[]).some((item:any)=>item.id===d.medication_id&&item.active));const waterGlasses=medicationWater(todayDoses);const navigate=useNavigate();const locationSearch=useRouterState({select:(state)=>state.location.search as Record<string,unknown>});const handledPushAction=useRef<string|null>(null);const pushDoseId=typeof locationSearch["dose"]==="string"?locationSearch["dose"]:null;const pushAction=locationSearch["action"]==="take"||locationSearch["action"]==="snooze"?locationSearch["action"]:null;useEffect(()=>{if(!pushDoseId||!pushAction){handledPushAction.current=null;return}const key=pushDoseId+":"+pushAction;if(handledPushAction.current===key)return;handledPushAction.current=key;m.setStatus.mutate({id:pushDoseId,status:pushAction==="take"?"taken":"snoozed"},{onSuccess:()=>{toast.success(pushAction==="take"?"Toma registrada desde la notificación.":"Dosis pospuesta 10 minutos.");void navigate({to:"/salud",search:(prev:Record<string,unknown>)=>({...prev,dose:undefined,action:undefined})})},onError:()=>{void navigate({to:"/salud",search:(prev:Record<string,unknown>)=>({...prev,dose:undefined,action:undefined})})}})},[pushDoseId,pushAction,m.setStatus.mutate,navigate]);return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{showPaused?"Mostrando medicamentos activos y pausados":`${medicationList.filter((item:any)=>item.active).length} medicamentos activos`}</p><div className="flex flex-wrap gap-2">{pausedCount>0&&<Button type="button" size="sm" variant="outline" onClick={()=>setShowPaused((value)=>!value)}>{showPaused?"Ocultar pausados":`Mostrar pausados (${pausedCount})`}</Button>}<Button onClick={()=>{setEditing(null);setOpen(true)}}><Plus className="mr-1 h-4 w-4"/>Medicamento</Button></div></div><section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Pill className="h-4 w-4"/><h2 className="font-semibold">{date===todayISO()?"Tomas de hoy":`Tomas del ${date}`}</h2></div><p className="text-xs text-muted-foreground">Agua con medicamentos: {formatGlasses(waterGlasses)} <HelpTip helpKey="hydration.medication"/></p></div>{doses.isError&&<div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">No se pudieron cargar las tomas programadas. <Button type="button" size="sm" variant="outline" className="ml-2" onClick={()=>void doses.refetch()}>Reintentar</Button><p className="mt-1 text-xs">{doses.error instanceof Error?doses.error.message:"Error desconocido"}</p></div>}{doses.isLoading&&activeTodayDoses.length===0&&<p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Cargando tomas programadas…</p>}{!doses.isLoading&&!doses.isError&&meds.isSuccess&&activeTodayDoses.length===0&&<p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No se generaron tomas para {date}. Comprueba la fecha de inicio y los horarios del medicamento.</p>}{activeTodayDoses.map((d:any)=>{const med=(meds.data||[]).find((x:any)=>x.id===d.medication_id);const actual=d.taken_at?new Date(d.taken_at):null;const persistedTime=actual?String(actual.getHours()).padStart(2,"0")+":"+String(actual.getMinutes()).padStart(2,"0"):"";const localActual=actualTimes[d.id]??persistedTime;return <div key={d.id} className="rounded-xl border p-3"><div className="flex items-center gap-2"><span className="flex-1"><b>{med?.name||"Medicamento"}</b><span className="ml-2 text-xs text-muted-foreground">programada {formatTime12(new Date(d.scheduled_at))}</span></span><div className="flex flex-wrap items-center gap-2">{d.status==="taken"&&d.entry_origin==="stock_estimate"?<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">Estimación por existencias · confirma</span>:d.status==="taken"?<span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Registrada como tomada</span>:d.status==="skipped"?<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">Registrada como omitida</span>:<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{d.status==="snoozed"?"Pospuesta":"Pendiente"}</span>}<Button size="sm" variant={d.status==="taken"&&d.entry_origin!=="stock_estimate"?"default":"outline"} onClick={()=>{const timeValue=localActual||new Date().toTimeString().slice(0,5);setActualTimes(current=>({...current,[d.id]:timeValue}));m.setStatus.mutate({id:d.id,status:"taken",water:waterByDose[d.id]??Number(d.water_glasses??lastWater()),takenAt:new Date(date+"T"+timeValue).toISOString()})}}>Sí la tomé</Button><Button size="sm" variant={d.status==="skipped"?"destructive":"outline"} onClick={()=>m.setStatus.mutate({id:d.id,status:"skipped"})}>No la tomé</Button></div></div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Hora real</span><Input className="h-8 w-28" type="time" aria-label={"Hora real de toma de "+(med?.name||"medicamento")} value={localActual} onChange={e=>{const value=e.target.value;setActualTimes(current=>({...current,[d.id]:value}));if(d.status==="taken"&&value)m.setStatus.mutate({id:d.id,status:"taken",water:waterByDose[d.id]??Number(d.water_glasses??lastWater()),takenAt:new Date(date+"T"+value).toISOString()})}} placeholder="12:45"/>{actual&&<span>tomada a las {localActual}{new Date(d.taken_at).getTime()>new Date(d.scheduled_at).getTime()?" · después de la hora programada":""}</span>}{!actual&&localActual&&<span>Se usará al marcar la toma</span>}</div><div className="mt-3 flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-xs text-muted-foreground">¿Con cuánta agua la tomaste? <HelpTip helpKey="medication.water"/><select className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={waterByDose[d.id]??Number(d.water_glasses??lastWater())} onChange={e=>{const value=Number(e.target.value);setWaterByDose(current=>({...current,[d.id]:value}));if(d.status==="taken")m.setWater.mutate({id:d.id,glasses:value})}}>{WATER_OPTIONS.map(value=><option key={value} value={value}>{value===0?"Sin agua":formatWaterGlassOption(value)}</option>)}</select></label></div></div>})}<div className="space-y-2 border-t border-border pt-3">
<div><p className="flex items-center gap-1 font-semibold text-sm">Historial de medicamentos <HelpTip helpKey="health.medicationHistory"/></p><p className="mt-1 text-xs text-muted-foreground">Solo aparecen tomas confirmadas u omitidas del ciclo actual. Las dosis que quedaron pendientes no se cuentan como consumo.</p></div>
{history.isError ? (
  <p className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive" role="alert">No se pudo cargar el historial de tomas. Revisa la conexión e inténtalo de nuevo.</p>
) : history.isLoading ? (
  <p className="text-sm text-muted-foreground">Cargando historial…</p>
) : historyRows.length===0 ? (
  <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No hay tomas en este rango de fechas.</p>
) : (
  <div className="max-h-80 space-y-2 overflow-y-auto">
  {historyRows.map((d:any)=>{const med=(meds.data||[]).find((x:any)=>x.id===d.medication_id);return <div key={d.id} className="flex items-center gap-2 rounded-xl border p-2 text-xs"><span className="flex-1"><b>{med?.name||"Medicamento"}</b><span className="ml-2 text-muted-foreground">{d.dose_date} · programada {formatTime12(new Date(d.scheduled_at))}{d.taken_at?" · tomada "+formatTime12(new Date(d.taken_at)):""}</span></span><span className={d.status==="taken"?"text-success":"text-muted-foreground"}>{d.status==="taken"?"Tomada":d.status==="skipped"?"Omitida":d.status==="snoozed"?"Pospuesta":"Pendiente"}</span>{d.entry_origin==="stock_estimate"&&<span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">Estimado por existencias</span>}{d.entry_origin==="restored_snapshot"&&<span className="rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">Restaurado de captura</span>}</div>})}
  </div>
)}
<div className="flex flex-wrap items-center justify-between gap-2">
  <p className="text-xs text-muted-foreground">Rango: últimos {historyDays} días · {historyTotal} tomas encontradas · página {historyPage+1} de {historyPageCount} · Tomas confirmadas en el ciclo actual: {Object.values(taken.data||{}).reduce((a,b)=>a+b,0)}.</p>
  <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" variant="outline" disabled={historyPage===0||history.isFetching} onClick={()=>setHistoryPage(page=>Math.max(0,page-1))}>Anterior</Button>
    <Button size="sm" variant="outline" disabled={historyPage+1>=historyPageCount||history.isFetching} onClick={()=>setHistoryPage(page=>Math.min(historyPageCount-1,page+1))}>Siguiente</Button>
    <Button size="sm" variant="outline" disabled={historyDays>=3650||history.isFetching} onClick={()=>{setHistoryPage(0);setHistoryDays(days=>Math.min(3650,days+90))}}>{historyDays>=3650?"Máximo cargado":"Ver 90 días más"}</Button>
  </div>
</div>
</div></section><div className="grid gap-3 md:grid-cols-2">{displayedMeds.map((x:any)=>{const remaining=remainingQuantity(x,Number(taken.data?.[x.id]??0),Number(stock.data?.[x.id]??0));const days=remaining===null?null:durationDays({...x,total_quantity:remaining});return <article key={x.id} className={"glass rounded-2xl border p-4 "+(x.active?"border-border":"border-dashed border-muted-foreground/40 opacity-90")}><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{x.name}</h2><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold "+(x.active?"bg-primary/10 text-primary":"bg-muted text-muted-foreground")}>{x.active?"Activo":"Pausado"}</span></div><p className="text-xs text-muted-foreground">{medicationScheduleLabel(x)}</p>{remaining!==null&&<p className="mt-2 text-sm">Restantes: <b>{formatStockQuantity(remaining,x.stock_unit||"unidades")}</b> <HelpTip helpKey="medication.remaining"/></p>}{days!==null&&<p className="text-xs text-muted-foreground">Duración estimada: {days} días aproximados </p>}</div></div>{remaining!==null&&remaining<=0&&<p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">Sin existencias. El registro y los recordatorios siguen activos; repón el inventario cuando compres más.</p>}<div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t border-border pt-3"><Input aria-label={"Cantidad para reponer "+x.name} type="number" min="0.001" step="0.001" className="h-9" placeholder={"Reponer ("+(x.stock_unit||"unidades")+")"} value={restockInputs[x.id]??""} onChange={e=>setRestockInputs(current=>({...current,[x.id]:e.target.value}))}/><Button size="sm" variant="outline" disabled={!Number.isFinite(Number(restockInputs[x.id]))||Number(restockInputs[x.id])<=0||m.addStock.isPending} onClick={()=>void m.addStock.mutateAsync({medicationId:x.id,quantity:Number(restockInputs[x.id])}).then(()=>setRestockInputs(current=>({...current,[x.id]:""})))}><Plus className="mr-1 h-3.5 w-3.5"/>Reponer</Button></div><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>{setEditing(x);setOpen(true)}}><Pencil className="mr-1 h-3.5 w-3.5"/>Editar</Button><Button size="sm" variant={x.active?"ghost":"default"} onClick={()=>{if(x.active){void m.remove.mutateAsync(x.id).catch(()=>undefined)}else{setEditing({...x,active:true,start_date:x.start_date<todayISO()?todayISO():x.start_date,end_date:null});setOpen(true)}}}>{x.active?"Pausar medicamento":"Reactivar medicamento"}</Button></div></article>})}</div>{displayedMeds.length===0&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{showPaused?"No hay medicamentos registrados todavía.":"No tienes medicamentos activos. Puedes mostrar los pausados o registrar uno nuevo."}</p>}<MedicationDialog open={open} onOpenChange={o=>{setOpen(o);if(!o)setEditing(null)}} medication={editing} pending={m.create.isPending||m.update.isPending} onSubmit={async input=>{if(editing)await m.update.mutateAsync({id:editing.id,patch:input});else await m.create.mutateAsync(input);}}/></section>}
function Cycle(){const q=useLGList("menstrual_profiles");const records=useLGList("menstrual_records","start_date");const m=useLGMutations("menstrual_profiles");const rm=useLGMutations("menstrual_records");const{user}=useAuth();const[subject,setSubject]=useState(""),[type,setType]=useState("self"),[cycle,setCycle]=useState("28"),[period,setPeriod]=useState("5"),[start,setStart]=useState(""),[notes,setNotes]=useState("");const profiles=q.data||[];return <section className="space-y-4"><div className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center gap-2"><CalendarHeart className="h-4 w-4"/><h2 className="font-semibold">Registro menstrual</h2><HelpTip helpKey="health.cycle"/></div><p className="text-xs text-muted-foreground">Puede ser para ti o para la persona cuyo ciclo registras. La próxima fecha se calcula automáticamente con el ciclo promedio o el ciclo indicado.</p><div className="grid gap-2 sm:grid-cols-4"><Input placeholder="Persona" value={subject} onChange={e=>setSubject(e.target.value)}/><select className="h-10 rounded-md border bg-background px-3" value={type} onChange={e=>setType(e.target.value)}><option value="self">Yo</option><option value="partner">Pareja</option><option value="family">Familiar</option><option value="other">Otra persona</option></select><Input type="number" min="15" max="60" placeholder="Ciclo días" value={cycle} onChange={e=>setCycle(e.target.value)}/><Input type="number" min="1" max="14" placeholder="Duración periodo" value={period} onChange={e=>setPeriod(e.target.value)}/></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Notas del perfil…"/><Button disabled={!subject.trim()} onClick={()=>void m.create.mutateAsync({user_id:user?.id,subject_name:subject.trim(),subject_type:type,average_cycle_days:Number(cycle)||28,average_period_days:Number(period)||5,notes:notes||null}).then(()=>setSubject(""))}><Plus className="mr-1 h-4 w-4"/>Crear perfil</Button></div>{profiles.map((p:any)=><CycleProfile key={p.id} profile={p} records={records.data||[]} rm={rm}/>)}</section>}
function CycleProfile({profile,records,rm}:{profile:any;records:any[];rm:any}){const{user}=useAuth();const[start,setStart]=useState(""),[end,setEnd]=useState(""),[flow,setFlow]=useState(""),[notes,setNotes]=useState("");const own=records.filter(r=>r.profile_id===profile.id);const latest=own[0];return <article className="glass space-y-3 rounded-2xl p-4"><div className="flex gap-2"><div className="flex-1"><h3 className="font-semibold">{profile.subject_name}</h3><p className="text-xs text-muted-foreground">Ciclo {profile.average_cycle_days} días · duración {profile.average_period_days} días</p></div><Button size="icon" variant="ghost" onClick={()=>void rm.remove.mutateAsync(profile.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div><div className="grid gap-2 sm:grid-cols-4"><Input type="date" value={start} onChange={e=>setStart(e.target.value)}/><Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/><Input placeholder="Flujo" value={flow} onChange={e=>setFlow(e.target.value)}/><Button disabled={!start} onClick={()=>void rm.create.mutateAsync({user_id:user?.id,profile_id:profile.id,start_date:start,end_date:end||null,flow:flow||null,notes:notes||null}).then(()=>setStart(""))}>Registrar periodo</Button></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Síntomas, notas…"/>{latest&&<div className="rounded-xl border p-3 text-sm"><b>Próxima fecha estimada:</b> {latest.next_period_on}<span className="ml-2 text-xs text-muted-foreground">Ciclo usado: {latest.cycle_length_days} días</span></div>}</article>}
function Appointments(){const q=useLGList("medical_appointments","appointment_at");const m=useLGMutations("medical_appointments");const{user}=useAuth();const[title,setTitle]=useState(""),[date,setDate]=useState(""),[provider,setProvider]=useState(""),[location,setLocation]=useState(""),[notes,setNotes]=useState("");return <section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4"/><h2 className="font-semibold">Citas médicas</h2></div><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Cita / examen" value={title} onChange={e=>setTitle(e.target.value)}/><Input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/><Input placeholder="Profesional / clínica" value={provider} onChange={e=>setProvider(e.target.value)}/><Input placeholder="Lugar" value={location} onChange={e=>setLocation(e.target.value)}/></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Indicaciones, preparación o preguntas…"/><Button disabled={!title.trim()||!date} onClick={()=>void m.create.mutateAsync({user_id:user?.id,title:title.trim(),appointment_at:new Date(date).toISOString(),provider:provider||null,location:location||null,notes:notes||null,reminder_minutes:[10080,1440,60,0],alarm_enabled:true}).then(()=>setTitle(""))}><Plus className="mr-1 h-4 w-4"/>Guardar cita</Button>{(q.data||[]).map((x:any)=><div key={x.id} className="flex gap-2 rounded-xl border p-3"><span className="flex-1"><b>{x.title}</b><span className="ml-2 text-xs text-muted-foreground">{new Date(x.appointment_at).toLocaleString("es-CO")}</span></span><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</section>}
function Nutrition(){const q=useLGList("nutrition_logs","log_date");const m=useLGMutations("nutrition_logs");const{user}=useAuth();const{date}=useGlobalDate();const[meal,setMeal]=useState(""),[cal,setCal]=useState(""),[protein,setProtein]=useState(""),[notes,setNotes]=useState("");useEffect(()=>{setMeal("");setCal("");setProtein("");setNotes("")},[date]);const clearForm=()=>{setMeal("");setCal("");setProtein("");setNotes("")};const hasNutritionInput=[meal,cal,protein,notes].some(v=>v.trim().length>0);return <section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center gap-2"><HeartPulse className="h-4 w-4"/><h2 className="flex items-center gap-2 font-semibold">Nutrición <HelpTip helpKey="health.nutrition" /></h2></div><div className="grid gap-2 sm:grid-cols-4"><Input placeholder="Comida (desayuno…)" value={meal} onChange={e=>setMeal(e.target.value)}/><Input type="number" placeholder="kcal" value={cal} onChange={e=>setCal(e.target.value)}/><Input type="number" placeholder="Proteína g" value={protein} onChange={e=>setProtein(e.target.value)}/></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Alimentos, porciones y notas…"/><Button disabled={!hasNutritionInput||m.create.isPending} onClick={()=>void m.create.mutateAsync({user_id:user?.id,log_date:date,meal_type:meal.trim()||null,calories:cal.trim()?Number(cal):null,protein_g:protein.trim()?Number(protein):null,notes:notes.trim()||null}).then(clearForm)}><Plus className="mr-1 h-4 w-4"/>{m.create.isPending?"Guardando…":"Registrar"}</Button>{(q.data||[]).filter((x:any)=>x.log_date===date).map((x:any)=><div key={x.id} className="rounded-xl border p-3"><b>{x.meal_type||"Comida"}</b><span className="ml-2 text-xs text-muted-foreground">{x.calories||0} kcal · {x.protein_g||0} g proteína</span></div>)}</section>}
