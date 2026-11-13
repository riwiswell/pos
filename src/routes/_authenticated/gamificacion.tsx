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

const XP_ACTIONS = [
  ["Registrar un hábito del día", 5],
  ["Escribir una entrada en Diario", 5],
  ["Registrar una tarea o acción de trabajo", 5],
  ["Registrar un bloque de trabajo", 10],
  ["Registrar una medición de salud", 5],
  ["Registrar un movimiento financiero", 2],
  ["Registrar una sesión de lectura de un libro", 10],
  ["Registrar una sesión de estudio de idioma", 10],
  ["Registrar una sesión de videojuego", 10],
  ["Terminar un libro (una sola vez)", 20],
  ["Terminar un videojuego (una sola vez)", 20],
  ["Subir un nivel en un idioma (una sola vez por nivel)", 20],
  ["Completar las tres lecturas del Plan Bíblico", 15],
  ["Alcanzar 2.000 ml de agua simple en el día", 10],
  ["Registrar una interacción en Relaciones", 8],
  ["Registrar una práctica o reflexión espiritual", 5],
  ["Registrar una acción en una meta de Vida", 5],
  ["Completar una rutina", 5],
] as const;

const XP_ACHIEVEMENTS = [
  ["Primera acción", 10],
  ["Diez acciones", 25],
  ["Racha de siete días", 30],
  ["Primera interacción en Relaciones", 15],
  ["Primera entrada espiritual", 15],
  ["Primera sesión de aprendizaje", 15],
  ["Primer bloque de trabajo", 15],
] as const;

const FIRST_LEVEL_XP = 1200;
const LEVEL_XP_INCREMENT = 300;

/** Each level takes more XP than the previous one. XP is lifetime cumulative. */
function getLevelProgress(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let xpAtLevelStart = 0;
  let xpRequiredForLevel = FIRST_LEVEL_XP;

  while (safeXp >= xpAtLevelStart + xpRequiredForLevel) {
    xpAtLevelStart += xpRequiredForLevel;
    level += 1;
    xpRequiredForLevel += LEVEL_XP_INCREMENT;
  }

  const xpIntoLevel = safeXp - xpAtLevelStart;
  return {
    level,
    xpIntoLevel,
    xpRequiredForLevel,
    xpToNext: xpRequiredForLevel - xpIntoLevel,
  };
}

function GamificationPage() {
  const xpEvents=useLGList("gamification_xp_events");
  const profile=useLGList("gamification_profiles");
  const ach=useLGList("gamification_achievements");
  const ch=useLGList("gamification_challenges");
  const cm=useLGMutations("gamification_challenges");
  const {user}=useAuth();
  const [ct,setCt]=useState(""),[reward,setReward]=useState("50"),[target,setTarget]=useState("10"),[kind,setKind]=useState("events");
  const eventXp=(xpEvents.data||[]).reduce((sum:number,event:any)=>sum+Math.max(0,Number(event.xp)||0),0);
  const xp=Math.max(Number(profile.data?.[0]?.xp||0),eventXp);
  const levelProgression = getLevelProgress(xp);
  const { level, xpIntoLevel: levelProgress, xpRequiredForLevel, xpToNext } = levelProgression;
  const unlocked=(ach.data||[]).filter((x:any)=>x.unlocked_at);
  const actionCount=(xpEvents.data||[]).filter((event:any)=>Boolean(event.life_event_id)&&!String(event.event_key||"").startsWith("achievement:")).length;
  const xpDateInBogota=(value:string)=>{
    const date=new Date(value);
    return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  };
  const lastActivityOn=profile.data?.[0]?.last_activity_on as string|undefined;
  const xpActivityDates=new Set((xpEvents.data||[]).map((event:any)=>xpDateInBogota(String(event.created_at||""))).filter(Boolean));
  let derivedStreakDate=xpActivityDates.has(todayISO())?todayISO():addDaysISO(todayISO(),-1);
  let derivedStreak=0;
  while(xpActivityDates.has(derivedStreakDate)&&derivedStreak<366){derivedStreak+=1;derivedStreakDate=addDaysISO(derivedStreakDate,-1);}
  const currentStreak=lastActivityOn&&(lastActivityOn===todayISO()||lastActivityOn===addDaysISO(todayISO(),-1))?Math.max(Number(profile.data?.[0]?.current_streak||0),derivedStreak):derivedStreak;
  const recentXp=useMemo(()=>[...(xpEvents.data||[])].slice(0,8),[xpEvents.data]);
  const todayKey=todayISO();
  const todayXp=(xpEvents.data||[]).filter((event:any)=>xpDateInBogota(String(event.created_at||""))===todayKey).reduce((sum:number,event:any)=>sum+Math.max(0,Number(event.xp)||0),0);
  const dailyXpGoal=30;
  const dailyXpProgress=Math.min(100,Math.round(todayXp/dailyXpGoal*100));
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
    <p className="text-sm text-muted-foreground">Los niveles exigen cada vez más esfuerzo: 1.200 XP para pasar del nivel 1 al 2; después, cada tramo aumenta 300 XP (1.500, 1.800, 2.100, 2.400…). Todo el XP válido del historial se acumula y cuenta. Los nuevos usuarios comienzan en nivel 1 y deben ganarse cada avance. El nivel mide tu constancia; no desbloquea funciones adicionales.</p>
    <section className="relative overflow-hidden rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-card to-cyan-500/10 p-5 shadow-sm sm:p-7">
      <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"/>
      <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-400">Tu evolución</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-5xl font-bold tracking-tight">{xp.toLocaleString("es-CO")}</span><span className="text-sm text-muted-foreground">XP acumulados</span></div>
          <p className="mt-2 text-sm text-muted-foreground">Nivel {level} · Te faltan {xpToNext} XP para el nivel {level+1}</p>
          <div className="mt-4 h-3 max-w-xl overflow-hidden rounded-full bg-muted/80"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{width:(levelProgress/xpRequiredForLevel*100)+"%"}}/></div>
          <div className="mt-1 flex max-w-xl justify-between text-[11px] text-muted-foreground"><span>{levelProgress.toLocaleString("es-CO")} / {xpRequiredForLevel.toLocaleString("es-CO")} XP</span><span>Nivel {level+1}</span></div>
        </div>
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-[6px] border-violet-400/30 bg-background/70 shadow-inner sm:h-32 sm:w-32">
          <Trophy className="mb-1 h-5 w-5 text-violet-400"/><span className="text-3xl font-bold">{level}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Nivel</span>
        </div>
      </div>
    </section>
    <section className="glass space-y-4 rounded-2xl p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Zap className="h-4 w-4 text-amber-500"/>¿Cómo se consiguen los XP?</h2>
        <p className="mt-1 text-xs text-muted-foreground">Esta es la tabla de puntos que usa actualmente Personal OS. Cada registro real genera los puntos indicados una sola vez por evento.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Acciones</h3>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60"><tr><th className="px-3 py-2 font-semibold">Acción registrada</th><th className="w-20 px-3 py-2 text-right font-semibold">XP</th></tr></thead>
              <tbody>{XP_ACTIONS.map(([label,points])=><tr key={label} className="border-t border-border/70"><td className="px-3 py-2">{label}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">+{points}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-amber-500"/>Vitrina de trofeos</h3>
          <p className="mb-3 text-xs text-muted-foreground">Los trofeos celebran hitos permanentes. Los que aún no has desbloqueado permanecen aquí como objetivos.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...(ach.data||[])].sort((a:any,b:any)=>Number(Boolean(b.unlocked_at))-Number(Boolean(a.unlocked_at))||String(a.title||"").localeCompare(String(b.title||""),"es")).map((item:any)=>{
              const trophyIcons:Record<string,string>={first_action:"🌱",ten_actions:"🎯",seven_day_streak:"🔥",first_relationship:"💛",first_spiritual_entry:"🕊️",first_learning_session:"📚",first_work_session:"⏱️",first_book_finished:"📖",first_game_finished:"🎮",first_language_levelup:"🌎",first_bible_day:"✨",first_water_goal:"💧"};
              const earned=Boolean(item.unlocked_at);
              return <div key={item.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${earned?"border-amber-400/30 bg-amber-400/[.06]":"border-border bg-muted/20 opacity-70"}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background text-2xl shadow-sm">{trophyIcons[item.code]||"🏆"}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-xs">{item.title}</b><span className="mt-0.5 block text-[11px] text-muted-foreground">{item.description}</span><span className="mt-1 block text-[10px] font-medium">{earned?"🏆 Desbloqueado":"🔒 Por desbloquear"}</span></span>
              </div>;
            })}
            {(ach.data||[]).length===0&&<p className="text-xs text-muted-foreground">Tus primeros trofeos aparecerán después de registrar tus próximas acciones con XP.</p>}
          </div>
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-semibold">Hitos que puedes perseguir</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {XP_ACHIEVEMENTS.map(([label,points])=><div key={label} className="flex justify-between gap-2 text-xs"><span>{label}</span><b className="shrink-0 tabular-nums">+{points}</b></div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-muted/45 p-3 text-xs">
        <p className="font-semibold">Ejemplos para llegar a 30 XP en un día</p>
        <p className="mt-1 text-muted-foreground">6 hábitos registrados (6 × 5 XP), 3 sesiones de lectura o idiomas (3 × 10 XP), o 4 interacciones en Relaciones (4 × 8 XP = 32 XP). Terminar un libro suma 20 XP una sola vez por libro; también puedes ganar 20 XP al terminar un videojuego o subir de nivel en un idioma.</p>
      </div>
      <p className="text-xs text-muted-foreground">La meta diaria de 30 XP es una referencia de progreso: completarla no entrega otros 30 XP adicionales. Los bonos de logros sí se suman aparte, pero solo la primera vez. Las tomas de medicamentos, registro menstrual y citas todavía no generan XP automático. El agua simple sí otorga +10 XP una vez al día al llegar a 2.000 ml.</p>
    </section>
    <section className="glass space-y-3 rounded-2xl border border-amber-400/20 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Misión de hoy</p><h2 className="mt-1 flex items-center gap-2 font-semibold"><Flame className="h-4 w-4 text-amber-500"/>Consigue 30 XP</h2><p className="mt-1 text-xs text-muted-foreground">Suma puntos al registrar acciones. La tabla de abajo te muestra cuánto vale cada una.</p></div>
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
