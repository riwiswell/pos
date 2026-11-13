import { toast } from "sonner";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Trophy, Plus, Target, Zap, CheckCircle2, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { HelpTip } from "@/components/common/HelpTip";
import { ErrorState } from "@/components/common/States";
import { useLGList, useLGMutations } from "@/hooks/use-life-graph";
import { useAuth } from "@/hooks/use-auth";
import { addDaysISO, todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/gamificacion")({ component: GamificationPage });

function GamificationPage() {
  const xpEvents=useLGList("gamification_xp_events");
  const profile=useLGList("gamification_profiles");
  const ach=useLGList("gamification_achievements");
  const ch=useLGList("gamification_challenges");
  const cm=useLGMutations("gamification_challenges");
  const {user}=useAuth();
  const [ct,setCt]=useState(""),[reward,setReward]=useState("50"),[target,setTarget]=useState("10"),[kind,setKind]=useState("events");
  const xp=Number(profile.data?.[0]?.xp||0);
  const level=Number(profile.data?.[0]?.level||Math.floor(xp/100)+1);
  const unlocked=(ach.data||[]).filter((x:any)=>x.unlocked_at);
  const actionCount=(xpEvents.data||[]).filter((event:any)=>Boolean(event.life_event_id)&&!String(event.event_key||"").startsWith("achievement:")).length;
  const lastActivityOn=profile.data?.[0]?.last_activity_on as string|undefined;
  const currentStreak=lastActivityOn&&(lastActivityOn===todayISO()||lastActivityOn===addDaysISO(todayISO(),-1))?Number(profile.data?.[0]?.current_streak||0):0;
  const recentXp=useMemo(()=>[...(xpEvents.data||[])].slice(0,8),[xpEvents.data]);
  const todayKey=todayISO();
  const xpDateInBogota=(value:string)=>{
    const date=new Date(value);
    return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  };
  const todayXp=(xpEvents.data||[]).filter((event:any)=>xpDateInBogota(String(event.created_at||""))===todayKey).reduce((sum:number,event:any)=>sum+Math.max(0,Number(event.xp)||0),0);
  const dailyXpGoal=30;
  const dailyXpProgress=Math.min(100,Math.round(todayXp/dailyXpGoal*100));
  const levelProgress=xp%100;
  const xpToNext=100-levelProgress;
  const weeklyXp=useMemo(()=>{
    const now=new Date();
    const days=Array.from({length:7},(_,index)=>{
      const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()-6+index,12);
      const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
      return {key,label:new Intl.DateTimeFormat("es-CO",{weekday:"short"}).format(date).replace(".",""),xp:0};
    });
    const byDay=new Map(days.map(day=>[day.key,day]));
    for(const event of xpEvents.data||[]){
      if(!event.created_at)continue;
      const date=new Date(event.created_at);
      if(Number.isNaN(date.getTime()))continue;
      const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
      const day=byDay.get(key);
      if(day)day.xp+=Number(event.xp)||0;
    }
    return days;
  },[xpEvents.data]);
  const weeklyTotal=weeklyXp.reduce((sum,day)=>sum+day.xp,0);
  const weeklyMax=Math.max(1,...weeklyXp.map(day=>day.xp));
  if(xpEvents.isError||profile.isError||ach.isError||ch.isError){const error=xpEvents.error??profile.error??ach.error??ch.error;return <div className="space-y-5 pb-24"><GlobalDateHeader/><ErrorState message={error instanceof Error?error.message:"No se pudieron cargar los datos de gamificación."}/></div>}
  return <div className="space-y-5 pb-24">
    <GlobalDateHeader/>
    <div className="flex items-center gap-2"><Trophy className="h-5 w-5"/><h1 className="text-xl font-semibold">Gamificación</h1><HelpTip helpKey="gamification"/></div>
    <p className="text-sm text-muted-foreground">El motor convierte acciones reales del sistema en XP y progreso. No se premia la presión ni se castigan los días sin actividad.</p>
    <section className="relative overflow-hidden rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-card to-cyan-500/10 p-5 shadow-sm sm:p-7">
      <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"/>
      <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-400">Tu evolución</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-5xl font-bold tracking-tight">{xp.toLocaleString("es-CO")}</span><span className="text-sm text-muted-foreground">XP acumulados</span></div>
          <p className="mt-2 text-sm text-muted-foreground">Nivel {level} · Te faltan {xpToNext} XP para el nivel {level+1}</p>
          <div className="mt-4 h-3 max-w-xl overflow-hidden rounded-full bg-muted/80"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{width:levelProgress+"%"}}/></div>
          <div className="mt-1 flex max-w-xl justify-between text-[11px] text-muted-foreground"><span>{levelProgress} / 100 XP</span><span>Nivel {level+1}</span></div>
        </div>
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-[6px] border-violet-400/30 bg-background/70 shadow-inner sm:h-32 sm:w-32">
          <Trophy className="mb-1 h-5 w-5 text-violet-400"/><span className="text-3xl font-bold">{level}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Nivel</span>
        </div>
      </div>
    </section>
    <section className="glass space-y-3 rounded-2xl border border-amber-400/20 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Misión de hoy</p><h2 className="mt-1 flex items-center gap-2 font-semibold"><Flame className="h-4 w-4 text-amber-500"/>Consigue 30 XP</h2><p className="mt-1 text-xs text-muted-foreground">Suma XP con acciones reales en tus módulos. Cada pequeño avance cuenta.</p></div>
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-4 border-amber-400/40 bg-amber-400/10"><span className="text-lg font-bold tabular-nums">{dailyXpProgress}%</span><span className="text-[9px] text-muted-foreground">hoy</span></div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all" style={{width:dailyXpProgress+"%"}}/></div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{todayXp} XP conseguidos</span><span>{Math.max(0,dailyXpGoal-todayXp)} XP restantes</span></div>
      {todayXp>=dailyXpGoal&&<p className="flex items-center gap-1.5 text-xs font-semibold text-amber-500"><Sparkles className="h-4 w-4"/>¡Misión diaria completada!</p>}
    </section>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Acciones premiadas</p><p className="mt-1 text-3xl font-bold">{actionCount}</p><p className="mt-1 text-[11px] text-muted-foreground">Registros de origen</p></div>
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Logros obtenidos</p><p className="mt-1 text-3xl font-bold">{unlocked.length}<span className="text-base font-normal text-muted-foreground">/{(ach.data||[]).length}</span></p><p className="mt-1 text-[11px] text-muted-foreground">Hitos desbloqueados</p></div>
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Racha actual</p><p className="mt-1 text-3xl font-bold">{currentStreak}<span className="ml-1 text-sm font-normal text-muted-foreground">días</span></p><p className="mt-1 text-[11px] text-muted-foreground">Actividad consecutiva</p></div>
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Mejor racha</p><p className="mt-1 text-3xl font-bold">{Number(profile.data?.[0]?.best_streak||0)}<span className="ml-1 text-sm font-normal text-muted-foreground">días</span></p><p className="mt-1 text-[11px] text-muted-foreground">Tu récord personal</p></div>
    </div>
    <section className="glass space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-semibold">Tu ritmo de esta semana</h2><p className="mt-1 text-xs text-muted-foreground">XP obtenidos por día · últimos 7 días</p></div><div className="text-right"><p className="text-2xl font-bold">{weeklyTotal.toLocaleString("es-CO")}</p><p className="text-[11px] text-muted-foreground">XP esta semana</p></div></div>
      <div className="grid grid-cols-7 items-end gap-2">
        {weeklyXp.map((day,index)=><div key={day.key} className="flex min-w-0 flex-col items-center gap-2"><span className="text-[10px] tabular-nums text-muted-foreground">{day.xp||""}</span><div className="flex h-24 w-full items-end overflow-hidden rounded-lg bg-muted/60"><div className="w-full rounded-lg bg-gradient-to-t from-violet-600 to-cyan-400 transition-all" style={{height:day.xp?Math.max(6,day.xp/weeklyMax*100)+"%":"0%"}}/></div><span className={"text-[10px] capitalize "+(index===6?"font-semibold text-foreground":"text-muted-foreground")}>{day.label}</span></div>)}
      </div>
    </section>
    <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold flex items-center gap-2"><Award className="h-4 w-4"/>Logros</h2>{(ach.data||[]).map((x:any)=><div key={x.id} className={"flex items-center gap-3 rounded-xl border p-3 "+(!x.unlocked_at?"opacity-50":"")}><Award className="h-4 w-4"/><div className="min-w-0 flex-1"><span className="font-medium">{x.title}</span><p className="text-xs text-muted-foreground">{x.description||"Hito personal"} · +{x.xp_reward||0} XP</p></div>{x.unlocked_at&&<CheckCircle2 className="h-4 w-4"/>}</div>)}{!(ach.data||[]).length&&<p className="text-sm text-muted-foreground">Tus logros aparecerán aquí cuando empieces a registrar acciones.</p>}</section>
    <section id="desafios" className="glass space-y-3 rounded-2xl p-4 scroll-mt-20"><h2 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4"/>Desafíos</h2>
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px_120px_auto]"><Input placeholder="Desafío" value={ct} onChange={e=>setCt(e.target.value)}/><select className="h-10 rounded-md border bg-background px-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="events">Acciones</option><option value="xp">XP</option><option value="streak_days">Racha</option></select><Input type="number" min="1" value={target} onChange={e=>setTarget(e.target.value)}/><Input type="number" min="0" value={reward} onChange={e=>setReward(e.target.value)}/><Button disabled={!ct.trim()||!Number.isInteger(Number(target))||Number(target)<1||!Number.isInteger(Number(reward))||Number(reward)<0} onClick={()=>void cm.create.mutateAsync({user_id:user?.id,title:ct.trim(),description:null,target:Number(target),progress:0,kind,status:"active",starts_on:todayISO(),ends_on:null,reward_xp:Number(reward)}).then(()=>setCt(""))}><Plus className="mr-1 h-4 w-4"/>Crear</Button></div>
      {(ch.data||[]).map((x:any)=><div key={x.id} className="rounded-xl border p-3"><div className="flex items-center gap-2"><span className="flex-1 font-medium">{x.title}</span><span className="text-xs">+{x.reward_xp||0} XP</span></div><p className="text-xs text-muted-foreground">{x.progress||0}/{x.target||0} · {x.kind==="xp"?"XP":x.kind==="streak_days"?"días consecutivos":"acciones"} · {x.status}</p><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:Math.min(100,Math.max(0,Number(x.progress||0)/Math.max(1,Number(x.target||1))*100))+"%"}}/></div></div>)}
      {!(ch.data||[]).length&&<div className="rounded-xl border border-dashed p-4"><p className="text-sm text-muted-foreground">Activa tu primera misión: registra tres acciones en Personal OS durante los próximos siete días.</p><Button size="sm" className="mt-3" disabled={cm.create.isPending||!user?.id} onClick={()=>void cm.create.mutateAsync({user_id:user?.id,title:"Mi primera misión",description:"Registra tres acciones reales en cualquiera de tus módulos.",target:3,progress:0,kind:"events",status:"active",starts_on:todayISO(),ends_on:addDaysISO(todayISO(),7),reward_xp:25}).then(()=>toast.success("¡Misión activada!"))}><Target className="mr-1 h-4 w-4"/>Activar misión</Button></div>}
    </section>
    <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold flex items-center gap-2"><Zap className="h-4 w-4"/>Últimas recompensas</h2>{recentXp.map((x:any)=><div key={x.id} className="flex items-center gap-3 rounded-xl border p-3"><span className="font-semibold">+{x.xp} XP</span><span className="flex-1 text-sm">{x.reason}</span><span className="text-xs text-muted-foreground">{String(x.created_at||"").slice(0,10)}</span></div>)}{!recentXp.length&&<p className="text-sm text-muted-foreground">Todavía no hay acciones premiadas.</p>}</section>
    <div className="text-xs text-muted-foreground">El XP se genera en la base de datos a partir de eventos reales y usa una clave única por evento para evitar duplicados.</div>
  </div>;
}
