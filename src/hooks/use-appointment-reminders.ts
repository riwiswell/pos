import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLGList } from "@/hooks/use-life-graph";

type Appointment = { id:string; title:string; appointment_at:string; status?:string|null; alarm_enabled?:boolean|null; reminder_minutes?:number[]|null };
const STORAGE_KEY = "personal-os:appointment-reminders-fired";
const LATE_WINDOW_MS = 10 * 60_000;
function readFired(): Set<string> {
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown; return new Set(Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[]); }
  catch { return new Set(); }
}
function reminderText(minutes:number) {
  if(minutes===0)return "Es la hora de tu cita.";
  if(minutes<60)return "Tu cita es en "+minutes+" minutos.";
  if(minutes<1440){const hours=Math.round(minutes/60);return "Tu cita es en "+hours+(hours===1?" hora.":" horas.");}
  const days=Math.round(minutes/1440);return "Tu cita es en "+days+(days===1?" día.":" días.");
}

/** Avisos locales globales: funcionan mientras Personal OS está abierto, sin VAPID. */
export function useAppointmentReminders() {
 const query=useLGList("medical_appointments","appointment_at");
 const [tick,setTick]=useState(0);
 const firedRef=useRef<Set<string>|null>(null);
 const registrationRef=useRef<ServiceWorkerRegistration|null>(null);
 useEffect(()=>{
   if(typeof window==="undefined")return;
   if("serviceWorker" in navigator){void navigator.serviceWorker.ready.then(r=>{registrationRef.current=r;}).catch(()=>undefined);}
   const timer=window.setInterval(()=>setTick(v=>v+1),10_000);
   return()=>window.clearInterval(timer);
 },[]);
 useEffect(()=>{
   if(typeof window==="undefined"||!query.data)return;
   if(!firedRef.current)firedRef.current=readFired();
   const fired=firedRef.current;const now=Date.now();let changed=false;
   for(const appointment of query.data as Appointment[]){
    if(appointment.alarm_enabled===false||(appointment.status&&appointment.status!=="scheduled"))continue;
    const at=Date.parse(appointment.appointment_at);if(!Number.isFinite(at))continue;
    const configured=Array.isArray(appointment.reminder_minutes)&&appointment.reminder_minutes.length?appointment.reminder_minutes:[0];
    const reminders=Array.from(new Set(configured.map(Number).filter(m=>Number.isFinite(m)&&m>=0)));
    for(const minutes of reminders){
     const fireAt=at-minutes*60_000;if(now<fireAt||now-fireAt>LATE_WINDOW_MS)continue;
     const key=appointment.id+":"+appointment.appointment_at+":"+minutes;if(fired.has(key))continue;
     fired.add(key);changed=true;
     const title="🩺 "+(appointment.title||"Cita médica");const body=reminderText(minutes);
     toast(title,{description:body,duration:60_000});
     if("Notification" in window&&Notification.permission==="granted"){
      const options:NotificationOptions={body,tag:"pos:appointment:"+appointment.id,requireInteraction:true};
      try{if(registrationRef.current){void registrationRef.current.showNotification(title,options).catch(()=>undefined);}else{new Notification(title,options);}}catch{/* El aviso dentro de Personal OS sigue disponible. */}
     }
    }
   }
   if(changed){try{const entries=Array.from(fired).slice(-500);firedRef.current=new Set(entries);localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));}catch{/* La deduplicación en memoria sigue funcionando. */}}
 },[query.data,query.dataUpdatedAt,tick]);
}
