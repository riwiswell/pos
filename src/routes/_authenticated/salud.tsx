import { useEffect,useMemo,useRef,useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CalendarHeart,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,ClipboardList,Coffee,CupSoda,Droplets,HeartPulse,Leaf,Pencil,Pill,Plus,Trash2 } from "lucide-react";
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
 const raw=String(value??"").trim();
 const match=/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2})(?:[.]([0-9]+))?)?$/.exec(raw);
 if(!match)return null;
 const hour=Number(match[1]);
 const minute=Number(match[2]);
 const second=match[3]===undefined?0:Number(match[3]);
 if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59||!Number.isInteger(second)||second<0||second>59)return null;
 return String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0");
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
 const [otherIcon,setOtherIcon]=useState("🍵");
 const [editingEntryId,setEditingEntryId]=useState<string|null>(null);
 const [editType,setEditType]=useState<BeverageType>("water");
 const [editMl,setEditMl]=useState("325");
 const [editName,setEditName]=useState("");
 const [editIcon,setEditIcon]=useState("🍵");
 const [editTime,setEditTime]=useState("08:00");
 const [confirmDeleteId,setConfirmDeleteId]=useState<string|null>(null);
 const [showTodayDrinks,setShowTodayDrinks]=useState(false);
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
 const addDrink=async(beverage_type:BeverageType,amount_ml:number,note?:string|null,icon?:string)=>{
  if(!Number.isInteger(amount_ml)||amount_ml<1||amount_ml>3000)return;
  if(beverage_type==="other"&&!note?.trim()){toast.error("Escribe el nombre de la bebida (por ejemplo, aguapanela o Frutiño).");return;}
  const defaultIcon:Record<BeverageType,string>={water:"💧",coffee:"☕",tea:"🍵",milk:"🥛",other:"🥤"};
  await hydration.create.mutateAsync({beverage_type,amount_ml,note,icon:icon??defaultIcon[beverage_type]});
  if(beverage_type==="other"){setOtherName("");setOtherIcon("🥤");}
 };
 const startEditing=(entry:HydrationEntry)=>{
  const consumedAt=new Date(entry.consumed_at);
  setEditingEntryId(entry.id);
  setEditType(entry.beverage_type);
  setEditMl(String(entry.amount_ml));
  setEditName(entry.note??"");
  setEditIcon(entry.icon??({water:"💧",coffee:"☕",tea:"🍵",milk:"🥛",other:"🥤"} as Record<BeverageType,string>)[entry.beverage_type]);
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
   await hydration.update.mutateAsync({id:editingEntryId,beverage_type:editType,amount_ml:amount,note:editType==="other"?editName.trim():null,icon:editIcon,consumed_time:editTime});
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
   toast.error("Introduce horas válidas, por ejemplo 9:30 y 23:30.");return;
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
    <select aria-label="Tipo de bebida" className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={otherType} onChange={e=>{const value=e.target.value as BeverageType;setOtherType(value);setOtherIcon(({water:"💧",coffee:"☕",tea:"🍵",milk:"🥛",other:"🥤"} as Record<BeverageType,string>)[value]);}}>
     <option value="coffee">Café</option><option value="tea">Té</option><option value="milk">Leche</option><option value="other">Otra bebida</option>
    </select>
    <Input aria-label="Cantidad en mililitros" className="h-9" type="number" min="1" max="3000" step="25" value={otherMl} onChange={e=>setOtherMl(e.target.value)}/>
    <Button size="sm" variant="outline" disabled={disabled||!Number.isInteger(Number(otherMl))||Number(otherMl)<1||Number(otherMl)>3000||(otherType==="other"&&!otherName.trim())} onClick={()=>void addDrink(otherType,Number(otherMl),otherType==="other"?otherName.trim():null,otherIcon)}>Registrar</Button>
   </div>
   <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">Icono de la bebida</p><div className="flex flex-wrap gap-1.5">{["🥤","🧃","🍹","🧋","🧉","🍶","🥛","☕","🫖","🍵","💧","🧊","🍋","🍊","🍓","🍉","🍍","🥥","🍇","🥭","🍑","🍒","🫐","🍌","🍏","🍯","🥣","🍼"].map(icon=><button key={icon} type="button" aria-label={"Elegir icono "+icon} aria-pressed={otherIcon===icon} onClick={()=>setOtherIcon(icon)} className={"grid h-9 w-9 place-items-center rounded-lg border text-xl "+(otherIcon===icon?"border-primary bg-primary/10":"border-border/60 hover:bg-accent")}>{icon}</button>)}</div></div>
   {otherType==="other"&&<Input aria-label="Nombre de la bebida" className="h-9" placeholder="Nombre (aguapanela, Frutiño, jugo…)" value={otherName} onChange={e=>setOtherName(e.target.value)} maxLength={80}/>}
  </div>
  <div className="space-y-2 rounded-xl border p-3">
   <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={showTodayDrinks} onClick={()=>setShowTodayDrinks(value=>!value)}>
    <span className="min-w-0"><b className="block text-sm">{date===todayISO()?"Lo que has tomado hoy":"Bebidas registradas ese día"}</b><span className="text-xs text-muted-foreground">{dayEntries.length} {dayEntries.length===1?"registro":"registros"}</span></span>
    {showTodayDrinks?<ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground"/>:<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground"/>}
   </button>
   {showTodayDrinks&&<div className="space-y-2">
   {entries.isLoading?<p className="text-xs text-muted-foreground">Cargando registros…</p>:dayEntries.length===0?<p className="text-xs text-muted-foreground">Todavía no hay bebidas individuales registradas para esta fecha.</p>:<div className="space-y-2">
    {dayEntries.map(entry=>{
     const label=entry.beverage_type==="other"?(entry.note?.trim()||"Otra bebida"):beverageLabels[entry.beverage_type];
     const Icon=entry.beverage_type==="water"?Droplets:entry.beverage_type==="coffee"?Coffee:entry.beverage_type==="tea"?Leaf:CupSoda;
     const timeLabel=new Date(entry.consumed_at).toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"});
     return <div key={entry.id} className="rounded-lg border border-border/70 p-2.5">
      {editingEntryId===entry.id?<div className="space-y-2">
       <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select aria-label="Tipo de bebida al editar" className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={editType} onChange={e=>setEditType(e.target.value as BeverageType)}>
         <option value="water">Agua</option><option value="coffee">Café</option><option value="tea">Té</option><option value="milk">Leche</option><option value="other">Otra bebida</option>
        </select>
        <Input aria-label="Cantidad en mililitros al editar" className="h-9" type="number" min="1" max="3000" step="25" value={editMl} onChange={e=>setEditMl(e.target.value)}/>
        <Input aria-label="Hora del registro" className="h-9" type="time" value={editTime} onChange={e=>setEditTime(e.target.value)}/>
        {editType==="other"&&<div className="col-span-2 space-y-1.5 sm:col-span-4"><div className="flex flex-wrap gap-1">{["🥤","🧃","🍹","🧋","🧉","🍶","🥛","☕","🫖","🍵","💧","🧊","🍋","🍊","🍓","🍉","🍍","🥥","🍇","🥭","🍑","🍒","🫐","🍌","🍏","🍯","🥣","🍼"].map(icon=><button key={icon} type="button" aria-label={"Elegir icono "+icon} aria-pressed={editIcon===icon} onClick={()=>setEditIcon(icon)} className={"grid h-8 w-8 place-items-center rounded-md border text-lg "+(editIcon===icon?"border-primary bg-primary/10":"border-border/60")}>{icon}</button>)}</div><Input aria-label="Nombre de la bebida al editar" className="h-9" placeholder="Nombre de la bebida" value={editName} onChange={e=>setEditName(e.target.value)} maxLength={80}/></div>
       </div>
       <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={()=>setEditingEntryId(null)}>Cancelar</Button>
        <Button type="button" size="sm" disabled={hydration.update.isPending} onClick={()=>void saveEntry()}>{hydration.update.isPending?"Guardando…":"Guardar cambios"}</Button>
       </div>
      </div>:<div className="flex flex-wrap items-center gap-2">
       <span className="flex min-w-0 flex-1 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">{entry.icon?<span className="text-lg">{entry.icon}</span>:<Icon className="h-4 w-4"/>}</span><span className="min-w-0"><b className="text-sm">{label}</b><span className="ml-2 text-xs text-muted-foreground">{timeLabel}</span></span></span>
       <span className="text-sm font-medium tabular-nums">{fmt(entry.amount_ml)} ml</span>
       <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={"Editar "+label} title="Editar registro" onClick={()=>startEditing(entry)}><Pencil className="h-4 w-4"/></Button>
       {confirmDeleteId===entry.id?<div className="flex items-center gap-1"><Button type="button" size="sm" variant="destructive" disabled={hydration.remove.isPending} onClick={()=>void deleteEntry(entry.id)}>Eliminar</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setConfirmDeleteId(null)}>Cancelar</Button></div>:<Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={"Eliminar "+label} title="Eliminar registro" onClick={()=>{setConfirmDeleteId(entry.id);setEditingEntryId(null);}}><Trash2 className="h-4 w-4"/></Button>}
      </div>}
     </div>;
    })}
   </div>}
   <p className="text-[11px] text-muted-foreground">Puedes corregir el tipo, nombre, cantidad y hora de cada bebida, o eliminar un registro incorrecto.</p>
   </div>}
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
function cycleShiftDate(value: string, offset: number) {
  const date = new Date(value + "T12:00:00");
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function cycleMonthShift(value: string, offset: number) {
  const date = new Date(value.slice(0, 7) + "-01T12:00:00");
  date.setMonth(date.getMonth() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), "01"].join("-");
}

const CYCLE_SYMPTOMS = [
  "Cólicos", "Dolor lumbar", "Dolor de cabeza", "Sensibilidad mamaria",
  "Hinchazón", "Cansancio", "Cambios de ánimo", "Acné", "Náuseas",
  "Cambios de apetito", "Diarrea o estreñimiento", "Otro",
];

const CYCLE_FLOW_OPTIONS = [
  ["none", "Sin sangrado"], ["spotting", "Manchado"], ["light", "Leve"],
  ["medium", "Moderado"], ["heavy", "Abundante"],
] as const;

function Cycle() {
  const q = useLGList("menstrual_profiles");
  const records = useLGList("menstrual_records", "start_date");
  const dailyLogs = useLGList("menstrual_daily_logs", "log_date");
  const m = useLGMutations("menstrual_profiles");
  const rm = useLGMutations("menstrual_records");
  const dm = useLGMutations("menstrual_daily_logs");
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("self");
  const profiles = q.data || [];

  return (
    <section className="space-y-4">
      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <CalendarHeart className="h-4 w-4" />
          <h2 className="font-semibold">Registro menstrual</h2>
          <HelpTip helpKey="health.cycle" />
        </div>
        <p className="text-xs text-muted-foreground">
          Registra el inicio cuando ocurra. No necesitas saber cuánto durará: cerrarás el período cuando termine y podrás anotar síntomas cada día.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_190px_auto]">
          <Input placeholder="Nombre o referencia (ej. Yo, Angie…)" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="self">Yo</option>
            <option value="partner">Pareja</option>
            <option value="family">Familiar</option>
            <option value="other">Otra persona</option>
          </select>
          <Button
            disabled={!subject.trim() || m.create.isPending}
            onClick={() => void m.create.mutateAsync({
              user_id: user?.id,
              subject_name: subject.trim(),
              subject_type: type,
              average_cycle_days: 28,
              average_period_days: 5,
              notes: null,
            }).then(() => setSubject(""))}
          >
            <Plus className="mr-1 h-4 w-4" /> Crear perfil
          </Button>
        </div>
      </div>

      {q.isError && <p className="text-sm text-destructive">No se pudieron cargar los perfiles menstruales.</p>}
      {records.isError && <p className="text-sm text-destructive">No se pudo cargar el historial de períodos.</p>}
      {dailyLogs.isError && <p className="text-sm text-destructive">No se pudieron cargar los registros diarios.</p>}
      {profiles.length === 0 && (
        <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
          No hay perfiles menstruales registrados. Esta sección es opcional; no necesitas crear uno si no la vas a utilizar.
        </div>
      )}
      {profiles.map((profile: any) => (
        <CycleProfile
          key={profile.id}
          profile={profile}
          records={records.data || []}
          dailyLogs={dailyLogs.data || []}
          profileMutations={m}
          periodMutations={rm}
          dailyMutations={dm}
        />
      ))}
    </section>
  );
}

function CycleProfile({
  profile, records, dailyLogs, profileMutations, periodMutations, dailyMutations,
}: {
  profile: any;
  records: any[];
  dailyLogs: any[];
  profileMutations: any;
  periodMutations: any;
  dailyMutations: any;
}) {
  const { user } = useAuth();
  const today = todayISO();
  const [newStart, setNewStart] = useState(today);
  const [closeDate, setCloseDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const [flow, setFlow] = useState("none");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const ownRecords = records
    .filter((record: any) => record.profile_id === profile.id)
    .sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
  const ownLogs = dailyLogs.filter((log: any) => log.profile_id === profile.id);
  const activePeriod = [...ownRecords].reverse().find((record: any) => !record.end_date);
  const selectedPeriod = ownRecords.find((record: any) =>
    selectedDate >= record.start_date && (!record.end_date ? selectedDate <= today : selectedDate <= record.end_date)
  );
  const selectedLog = ownLogs.find((log: any) =>
    log.record_id === selectedPeriod?.id && log.log_date === selectedDate
  );

  useEffect(() => {
    setFlow(selectedLog?.flow || "none");
    setSymptoms(Array.isArray(selectedLog?.symptoms) ? selectedLog.symptoms : []);
    setNotes(selectedLog?.notes || "");
  }, [selectedPeriod?.id, selectedDate, selectedLog?.id, selectedLog?.updated_at]);

  const actualIntervals = ownRecords
    .map((record: any, index: number) => index > 0
      ? Math.round((new Date(record.start_date + "T12:00:00").getTime() - new Date(ownRecords[index - 1].start_date + "T12:00:00").getTime()) / 86400000)
      : null)
    .filter((days: number | null) => days !== null && days >= 15 && days <= 60) as number[];
  const estimatedCycle = actualIntervals.length
    ? Math.round(actualIntervals.slice(-3).reduce((sum, days) => sum + days, 0) / Math.min(3, actualIntervals.length))
    : null;
  const latestRecord = ownRecords[ownRecords.length - 1];
  const nextEstimate = latestRecord && estimatedCycle
    ? cycleShiftDate(latestRecord.start_date, estimatedCycle)
    : null;
  const closedPeriods = ownRecords.filter((record: any) => record.end_date);
  const averageBleedingDays = closedPeriods.length
    ? Math.round(closedPeriods.reduce((sum: number, record: any) => {
        const duration = Math.round((new Date(record.end_date + "T12:00:00").getTime() - new Date(record.start_date + "T12:00:00").getTime()) / 86400000) + 1;
        return sum + duration;
      }, 0) / closedPeriods.length)
    : null;

  const monthDate = new Date(month + "T12:00:00");
  const year = monthDate.getFullYear();
  const monthNumber = monthDate.getMonth() + 1;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const mondayFirstOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const monthTitle = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(monthDate);
  const calendarCells = [
    ...Array.from({ length: mondayFirstOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const isPeriodDay = (date: string) => ownRecords.some((record: any) =>
    date >= record.start_date && date <= (record.end_date || today)
  );

  const startPeriod = async () => {
    if (!newStart || newStart > today) {
      toast.error("Elige una fecha de inicio que ya haya ocurrido.");
      return;
    }
    const overlap = ownRecords.some((record: any) =>
      newStart >= record.start_date && newStart <= (record.end_date || today)
    );
    if (overlap) {
      toast.error("Esa fecha ya pertenece a un período registrado.");
      return;
    }
    try {
      await periodMutations.create.mutateAsync({
        user_id: user?.id,
        profile_id: profile.id,
        start_date: newStart,
        end_date: null,
        flow: null,
        notes: null,
      });
      setMonth(newStart.slice(0, 7) + "-01");
      setSelectedDate(newStart);
      setCloseDate(today);
      toast.success("Inicio del período registrado.");
    } catch {
      // Mutation displays its own error.
    }
  };

  const closePeriod = async () => {
    if (!activePeriod || !closeDate) return;
    if (closeDate < activePeriod.start_date || closeDate > today) {
      toast.error("El fin debe estar entre el inicio y hoy.");
      return;
    }
    try {
      await periodMutations.update.mutateAsync({
        id: activePeriod.id,
        patch: { end_date: closeDate },
      });
      toast.success("Período cerrado. Su duración quedó guardada en el historial.");
    } catch {
      // Mutation displays its own error.
    }
  };

  const saveDailyLog = async () => {
    if (!selectedPeriod || !user?.id) return;
    const input = {
      user_id: user.id,
      profile_id: profile.id,
      record_id: selectedPeriod.id,
      log_date: selectedDate,
      flow,
      symptoms,
      notes: notes.trim() || null,
    };
    try {
      if (selectedLog) {
        await dailyMutations.update.mutateAsync({ id: selectedLog.id, patch: input });
        toast.success("Registro del día actualizado.");
      } else {
        await dailyMutations.create.mutateAsync(input);
        toast.success("Registro del día guardado.");
      }
    } catch {
      // Mutation displays its own error.
    }
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms((current) => current.includes(symptom)
      ? current.filter((item) => item !== symptom)
      : [...current, symptom]);
  };

  return (
    <article className="glass space-y-4 rounded-2xl p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{profile.subject_name}</h3>
          <p className="text-xs text-muted-foreground">{ownRecords.length} períodos registrados{averageBleedingDays ? " · duración media real: " + averageBleedingDays + " días" : ""}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={"Eliminar perfil " + profile.subject_name}
          onClick={() => {
            if (window.confirm("¿Eliminar el perfil y todo su historial menstrual? Esta acción no se puede deshacer.")) {
              void profileMutations.remove.mutateAsync(profile.id);
            }
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </header>

      <section className="rounded-xl border border-border/70 p-3">
        <h4 className="text-sm font-semibold">Registrar un período</h4>
        <p className="mt-1 text-xs text-muted-foreground">Solo necesitas indicar el primer día. El período quedará abierto hasta que registres su último día.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
            Primer día de sangrado
            <Input type="date" value={newStart} max={today} onChange={(event) => setNewStart(event.target.value)} />
          </label>
          <Button onClick={() => void startPeriod()} disabled={!newStart || periodMutations.create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Registrar inicio
          </Button>
        </div>
        {activePeriod && (
          <div className="mt-3 grid gap-2 rounded-xl bg-rose-500/5 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-medium text-rose-600 dark:text-rose-300">Período en curso desde {activePeriod.start_date}</p>
              <p className="text-xs text-muted-foreground">Cuando termine, selecciona aquí el último día de sangrado.</p>
              <Input className="mt-2 max-w-xs" type="date" min={activePeriod.start_date} max={today} value={closeDate} onChange={(event) => setCloseDate(event.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void closePeriod()} disabled={periodMutations.update.isPending}>
              Registrar fin del período
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold">Calendario del ciclo</h4>
            <p className="text-xs text-muted-foreground">Los días de período aparecen en rojo. Toca un día para consultar o completar su registro.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" aria-label="Mes anterior" onClick={() => setMonth(cycleMonthShift(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Mes siguiente" onClick={() => setMonth(cycleMonthShift(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mx-auto w-full md:w-1/2 rounded-xl border border-border/70 p-3">
          <p className="mb-3 text-center text-sm font-semibold capitalize">{monthTitle}</p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {["L", "M", "M", "J", "V", "S", "D"].map((label, index) => <span key={label + index}>{label}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarCells.map((day, index) => {
              if (day === null) return <span key={"blank-" + index} className="aspect-square" />;
              const date = year + "-" + String(monthNumber).padStart(2, "0") + "-" + String(day).padStart(2, "0");
              const isRed = isPeriodDay(date);
              const isSelected = selectedDate === date;
              const isToday = today === date;
              const hasLog = ownLogs.some((log: any) => log.log_date === date);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  disabled={date > today || !isRed}
                  aria-pressed={isSelected}
                  aria-label={date + (isRed ? ", día de período" : "") + (hasLog ? ", con registro diario" : "")}
                  className={[
                    "relative aspect-square rounded-lg text-xs font-medium transition",
                    isRed ? "bg-rose-500 text-white hover:bg-rose-600" : "text-muted-foreground hover:bg-muted",
                    isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    isToday ? "outline outline-1 outline-offset-1 outline-primary" : "",
                    date > today || !isRed ? "cursor-default opacity-55" : "",
                  ].join(" ")}
                >
                  {day}
                  {hasLog && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-rose-500" /> Días de período</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Día seleccionado</span>
            <span className="inline-flex items-center gap-1.5">• Punto blanco: registro diario guardado</span>
          </div>
        </div>
      </section>

      {selectedPeriod ? (
        <section className="space-y-3 rounded-xl border border-border/70 p-3">
          <div>
            <h4 className="font-semibold">Síntomas y flujo del día</h4>
            <p className="text-xs text-muted-foreground">{selectedDate} · Cada fecha tiene su propio registro.</p>
          </div>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Cantidad de flujo
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={flow} onChange={(event) => setFlow(event.target.value)}>
              {CYCLE_FLOW_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="space-y-2">
            <p className="text-xs font-medium">Síntomas de este día</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CYCLE_SYMPTOMS.map((symptom) => (
                <label key={symptom} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <input type="checkbox" checked={symptoms.includes(symptom)} onChange={() => toggleSymptom(symptom)} />
                  {symptom}
                </label>
              ))}
            </div>
          </div>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Notas de este día
            <textarea className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cómo se sintió hoy, intensidad, cambios o cualquier detalle…" />
          </label>
          <Button onClick={() => void saveDailyLog()} disabled={dailyMutations.create.isPending || dailyMutations.update.isPending}>
            Guardar registro de este día
          </Button>
        </section>
      ) : (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          Selecciona un día rojo del calendario para registrar su flujo y síntomas. Puedes consultar los días anteriores del historial.
        </p>
      )}

      {nextEstimate ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <b>Próxima fecha orientativa:</b> {nextEstimate}
          <p className="mt-1 text-xs text-muted-foreground">Calculada con {actualIntervals.length} intervalos reales entre inicios (promedio reciente: {estimatedCycle} días). Es una estimación, no una fecha confirmada.</p>
        </div>
      ) : (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          La próxima fecha estimada aparecerá cuando haya al menos dos inicios registrados y podamos calcular un intervalo real.
        </p>
      )}

      {ownRecords.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Historial de períodos</h4>
          {[...ownRecords].reverse().map((record: any) => {
            const duration = record.end_date
              ? Math.round((new Date(record.end_date + "T12:00:00").getTime() - new Date(record.start_date + "T12:00:00").getTime()) / 86400000) + 1
              : null;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => {
                  setSelectedDate(record.start_date);
                  setMonth(record.start_date.slice(0, 7) + "-01");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-left text-sm hover:bg-muted/40"
              >
                <span className="min-w-0"><b>{record.start_date}</b><span className="ml-2 text-xs text-muted-foreground">{record.end_date ? "hasta " + record.end_date : "En curso"}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{duration ? duration + (duration === 1 ? " día" : " días") : "Abierto"}</span>
              </button>
            );
          })}
        </section>
      )}
    </article>
  );
}


function Appointments(){const q=useLGList("medical_appointments","appointment_at");const m=useLGMutations("medical_appointments");const{user}=useAuth();const[title,setTitle]=useState(""),[date,setDate]=useState(""),[provider,setProvider]=useState(""),[location,setLocation]=useState(""),[notes,setNotes]=useState("");return <section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4"/><h2 className="font-semibold">Citas médicas</h2></div><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Cita / examen" value={title} onChange={e=>setTitle(e.target.value)}/><Input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/><Input placeholder="Profesional / clínica" value={provider} onChange={e=>setProvider(e.target.value)}/><Input placeholder="Lugar" value={location} onChange={e=>setLocation(e.target.value)}/></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Indicaciones, preparación o preguntas…"/><Button disabled={!title.trim()||!date} onClick={()=>void m.create.mutateAsync({user_id:user?.id,title:title.trim(),appointment_at:new Date(date).toISOString(),provider:provider||null,location:location||null,notes:notes||null,reminder_minutes:[10080,1440,60,0],alarm_enabled:true}).then(()=>setTitle(""))}><Plus className="mr-1 h-4 w-4"/>Guardar cita</Button>{(q.data||[]).map((x:any)=><div key={x.id} className="flex gap-2 rounded-xl border p-3"><span className="flex-1"><b>{x.title}</b><span className="ml-2 text-xs text-muted-foreground">{new Date(x.appointment_at).toLocaleString("es-CO")}</span></span><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</section>}
function Nutrition(){const q=useLGList("nutrition_logs","log_date");const m=useLGMutations("nutrition_logs");const{user}=useAuth();const{date}=useGlobalDate();const[meal,setMeal]=useState(""),[cal,setCal]=useState(""),[protein,setProtein]=useState(""),[notes,setNotes]=useState("");useEffect(()=>{setMeal("");setCal("");setProtein("");setNotes("")},[date]);const clearForm=()=>{setMeal("");setCal("");setProtein("");setNotes("")};const hasNutritionInput=[meal,cal,protein,notes].some(v=>v.trim().length>0);return <section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center gap-2"><HeartPulse className="h-4 w-4"/><h2 className="flex items-center gap-2 font-semibold">Nutrición <HelpTip helpKey="health.nutrition" /></h2></div><div className="grid gap-2 sm:grid-cols-4"><Input placeholder="Comida (desayuno…)" value={meal} onChange={e=>setMeal(e.target.value)}/><Input type="number" placeholder="kcal" value={cal} onChange={e=>setCal(e.target.value)}/><Input type="number" placeholder="Proteína g" value={protein} onChange={e=>setProtein(e.target.value)}/></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Alimentos, porciones y notas…"/><Button disabled={!hasNutritionInput||m.create.isPending} onClick={()=>void m.create.mutateAsync({user_id:user?.id,log_date:date,meal_type:meal.trim()||null,calories:cal.trim()?Number(cal):null,protein_g:protein.trim()?Number(protein):null,notes:notes.trim()||null}).then(clearForm)}><Plus className="mr-1 h-4 w-4"/>{m.create.isPending?"Guardando…":"Registrar"}</Button>{(q.data||[]).filter((x:any)=>x.log_date===date).map((x:any)=><div key={x.id} className="rounded-xl border p-3"><b>{x.meal_type||"Comida"}</b><span className="ml-2 text-xs text-muted-foreground">{x.calories||0} kcal · {x.protein_g||0} g proteína</span></div>)}</section>}
