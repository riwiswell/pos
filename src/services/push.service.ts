import { supabase } from "@/integrations/supabase/client";
const env = import.meta.env;
export async function subscribeToBackgroundPush(){
 if(typeof window==="undefined"||!("serviceWorker" in navigator)||!("PushManager" in window))return false;
 const key=env["VITE_VAPID_PUBLIC_KEY"] as string|undefined;if(!key)return false;
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key) as BufferSource});
 const {data:{session}}=await supabase.auth.getSession();if(!session)return false;
 const r=await fetch("/api/push-subscription",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({endpoint:sub.endpoint,subscription:sub.toJSON(),expiration_time:sub.expirationTime?new Date(sub.expirationTime).toISOString():null})});
 return r.ok;
}
function urlBase64ToUint8Array(input:string){const padding="=".repeat((4-input.length%4)%4);const raw=atob((input+padding).replace(/-/g,"+").replace(/_/g,"/"));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
