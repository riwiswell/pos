import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HabitCategory, HabitCategoryInput } from "@/domain/types";

const PALETTE = ["#7dd3fc","#a7f3d0","#fcd34d","#fca5a5","#c4b5fd","#f9a8d4","#94a3b8","#fdba74"];
interface Props { open:boolean; onOpenChange:(open:boolean)=>void; category:HabitCategory|null; onSubmit:(input:HabitCategoryInput)=>Promise<void>; }

export function CategoryDialog({open,onOpenChange,category,onSubmit}:Props){
 const[name,setName]=useState("");const[color,setColor]=useState(PALETTE[0]!);const[layoutColumns,setLayoutColumns]=useState<1|2|3>(1);const[saving,setSaving]=useState(false);
 useEffect(()=>{if(!open)return;setName(category?.name??"");setColor(category?.color??PALETTE[0]!);setLayoutColumns(category?.layout_columns===3?3:category?.layout_columns===2?2:1);},[open,category]);
 async function submit(event:React.FormEvent){event.preventDefault();if(!name.trim()||saving)return;setSaving(true);try{await onSubmit({name:name.trim(),color,layout_columns:layoutColumns});onOpenChange(false);}catch{/* Keep the dialog open; the mutation hook reports the backend error. */}finally{setSaving(false);}}
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{category?"Editar categoría":"Nueva categoría"}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4">
 <div className="space-y-1.5"><Label htmlFor="category-name">Nombre</Label><Input id="category-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Mañana" autoFocus required/></div>
 <div className="space-y-2"><Label>Color</Label><div className="flex flex-wrap gap-2">{PALETTE.map(c=><button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color===c} onClick={()=>setColor(c)} className={cn("h-7 w-7 rounded-full border-2 transition",color===c?"border-foreground":"border-transparent")} style={{backgroundColor:c}}/>)}</div></div>
 <div className="space-y-2"><Label>Distribución de hábitos</Label><div className="grid grid-cols-3 gap-2">{[1,2,3].map(columns=><button key={columns} type="button" aria-pressed={layoutColumns===columns} onClick={()=>setLayoutColumns(columns as 1|2|3)} className={cn("rounded-xl border px-3 py-3 text-sm transition",layoutColumns===columns?"border-primary bg-primary/10 font-semibold text-primary":"bg-background hover:bg-accent")}>{columns} {columns===1?"columna":"columnas"}<span className="mt-1 block text-[11px] font-normal text-muted-foreground">{columns===1?"Lista vertical":columns===2?"Distribución compacta":"Distribución más compacta"}</span></button>)}</div></div>
 <DialogFooter><Button type="submit" disabled={saving}>{saving?"Guardando…":category?"Guardar":"Crear"}</Button></DialogFooter></form></DialogContent></Dialog>;
}