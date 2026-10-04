import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Trophy, Plus, Target, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { HelpTip } from "@/components/common/HelpTip";
import { useLGList, useLGMutations } from "@/hooks/use-life-graph";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/gamificacion")({ component: GamificationPage });

function GamificationPage() {
  const events=useLGList("life_events");
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
  const actionCount=(xpEvents.data||[]).length;
  const recentXp=useMemo(()=>[...(xpEvents.data||[])].slice(0,8),[xpEvents.data]);
  return <div className="space-y-5 pb-24">
    <GlobalDateHeader/>
    <div className="flex items-center gap-2"><Trophy className="h-5 w-5"/><h1 className="text-xl font-semibold">Gamificación</h1><HelpTip helpKey="gamification"/></div>
    <p className="text-sm text-muted-foreground">El motor convierte acciones reales del sistema en XP y progreso. No se premia la presión ni se castigan los días sin actividad.</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">XP</p><p className="text-3xl font-bold">{xp}</p></div>
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Nivel</p><p className="text-3xl font-bold">{level}</p></div>
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Acciones premiadas</p><p className="text-3xl font-bold">{actionCount}</p></div>
      <div className="glass rounded-2xl p-4"><p className="text-xs text-muted-foreground">Logros</p><p className="text-3xl font-bold">{unlocked.length}</p></div>
    </div>
    <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold flex items-center gap-2"><Award className="h-4 w-4"/>Logros</h2>{(ach.data||[]).map((x:any)=><div key={x.id} className={"flex items-center gap-3 rounded-xl border p-3 "+(!x.unlocked_at?"opacity-50":"")}><Award className="h-4 w-4"/><div className="min-w-0 flex-1"><span className="font-medium">{x.title}</span><p className="text-xs text-muted-foreground">{x.description||"Hito personal"} · +{x.xp_reward||0} XP</p></div>{x.unlocked_at&&<CheckCircle2 className="h-4 w-4"/>}</div>)}</section>
    <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4"/>Desafíos</h2>
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px_120px_auto]"><Input placeholder="Desafío" value={ct} onChange={e=>setCt(e.target.value)}/><select className="h-10 rounded-md border bg-background px-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="events">Acciones</option><option value="xp">XP</option></select><Input type="number" min="1" value={target} onChange={e=>setTarget(e.target.value)}/><Input type="number" min="0" value={reward} onChange={e=>setReward(e.target.value)}/><Button disabled={!ct.trim()} onClick={()=>void cm.create.mutateAsync({user_id:user?.id,title:ct.trim(),description:null,target:Number(target)||1,progress:0,kind,status:"active",starts_on:new Date().toISOString().slice(0,10),ends_on:null,reward_xp:Number(reward)||0}).then(()=>setCt(""))}><Plus className="mr-1 h-4 w-4"/>Crear</Button></div>
      {(ch.data||[]).map((x:any)=><div key={x.id} className="rounded-xl border p-3"><div className="flex items-center gap-2"><span className="flex-1 font-medium">{x.title}</span><span className="text-xs">+{x.reward_xp||0} XP</span></div><p className="text-xs text-muted-foreground">{x.progress||0}/{x.target||0} · {x.kind==="xp"?"XP":"acciones"} · {x.status}</p><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:Math.min(100,Math.max(0,Number(x.progress||0)/Math.max(1,Number(x.target||1))*100))+"%"}}/></div></div>)}
    </section>
    <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold flex items-center gap-2"><Zap className="h-4 w-4"/>Últimas recompensas</h2>{recentXp.map((x:any)=><div key={x.id} className="flex items-center gap-3 rounded-xl border p-3"><span className="font-semibold">+{x.xp} XP</span><span className="flex-1 text-sm">{x.reason}</span><span className="text-xs text-muted-foreground">{String(x.created_at||"").slice(0,10)}</span></div>)}{!recentXp.length&&<p className="text-sm text-muted-foreground">Todavía no hay acciones premiadas.</p>}</section>
    <div className="text-xs text-muted-foreground">El XP se genera en la base de datos a partir de eventos reales y usa una clave única por evento para evitar duplicados.</div>
  </div>;
}
