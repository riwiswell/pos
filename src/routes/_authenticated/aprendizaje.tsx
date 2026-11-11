import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen,ChevronDown,ChevronUp,FileText,Globe2,ImagePlus,NotebookPen,Plus,Save,Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader"; import { HelpTip } from "@/components/common/HelpTip"; import { RichTextEditor } from "@/components/common/RichTextEditor";
import { SafeRichText } from "@/components/common/SafeRichText";
import { ErrorState } from "@/components/common/States";
import { useLGList,useLGMutations } from "@/hooks/use-life-graph"; import { lifeGraphService } from "@/services/life-graph.service"; import { useAuth } from "@/hooks/use-auth"; import { useProfile } from "@/hooks/use-profile"; import { useGlobalDate } from "@/hooks/use-global-date";
import { BibleReadingPanel } from "@/components/learning/BibleReadingPanel";
import { usePrivatePhotos } from "@/hooks/use-private-photos";
import { privateMediaService } from "@/services/private-media.service";
export const Route=createFileRoute("/_authenticated/aprendizaje")({component:LearningPage});
const LANGS=[
 {code:"en",name:"Inglés",variants:[["en-US","Estados Unidos"],["en-GB","Reino Unido"]]},
 {code:"it",name:"Italiano",variants:[["it-IT","Italia"]]},
 {code:"pt",name:"Portugués",variants:[["pt-BR","Brasil"],["pt-PT","Portugal"]]},
 {code:"fr",name:"Francés",variants:[["fr-FR","Francia"],["fr-CA","Canadá"]]},
];
function LearningPage(){const[tab,setTab]=useState("books");const{data:profile}=useProfile();const booksHidden=profile?.hidden_features?.["learning.books"]===true;const current=booksHidden&&tab==="books"?"other":tab;return <div className="space-y-5 pb-24"><GlobalDateHeader/><div><h1 className="flex items-center gap-2 text-xl font-semibold">Aprendizaje <HelpTip helpKey="learning" /></h1><p className="text-sm text-muted-foreground">Libros, cursos, idiomas, ajedrez y estudio conectado.</p></div><div className="flex gap-1.5">{([booksHidden?["other","Otros"]:["books","Libros"],["other","Otros"],["languages","Idiomas"]].filter((v:any,i:number,a:any[])=>i===a.findIndex(x=>x[0]===v[0]))).map(([k,v])=><button key={k} onClick={()=>setTab(k)} className={"rounded-full border px-3 py-1.5 text-xs "+(tab===k?"border-primary bg-primary/10":"border-border")}>{v}</button>)}</div>{current==="books"?<Books/>:current==="languages"?<Languages/>:<OtherLearning/>}</div>}
function isBibleBook(title:string){const normalized=title.trim().toLowerCase();return normalized==="la biblia"||normalized==="biblia";}
function Books(){
  const q=useLGList("learning_items");
  const notes=useLGList("learning_notes");
  const m=useLGMutations("learning_items");
  const nm=useLGMutations("learning_notes");
  const{user}=useAuth();
  const[adding,setAdding]=useState(false);
  const[title,setTitle]=useState("");
  const[pages,setPages]=useState("");
  const books=(q.data||[]).filter((x:any)=>x.kind==="book");

  const addBook=async()=>{
    if(!title.trim())return;
    await m.create.mutateAsync({
      user_id:user?.id,
      title:title.trim(),
      kind:"book",
      total_pages:Number(pages)>0?Number(pages):null,
      current_page:0,
      progress:0,
    });
    setTitle("");
    setPages("");
    setAdding(false);
    toast.success("Libro agregado a tu biblioteca.");
  };

  return <section className="space-y-3">
    {(q.isError||notes.isError)&&<ErrorState message={q.error instanceof Error?q.error.message:notes.error instanceof Error?notes.error.message:"No se pudieron cargar libros y notas."}/>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold">Mi biblioteca</h2>
        <p className="text-xs text-muted-foreground">Tus libros, avances, resúmenes y apuntes.</p>
      </div>
      <Button size="sm" variant={adding?"outline":"default"} onClick={()=>setAdding(v=>!v)}>
        {adding?"Cerrar":"Agregar libro"}
        {adding?<ChevronUp className="ml-1 h-4 w-4"/>:<Plus className="ml-1 h-4 w-4"/>}
      </Button>
    </div>

    {adding&&<div className="glass max-w-2xl space-y-3 rounded-2xl p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
        <Input placeholder="Título del libro" value={title} onChange={e=>setTitle(e.target.value)}/>
        <Input type="number" min="1" placeholder="Páginas (opcional)" value={pages} onChange={e=>setPages(e.target.value)}/>
        <Button disabled={!title.trim()||m.create.isPending||(isBibleBook(title)&&books.some((book:any)=>isBibleBook(book.title)))} onClick={()=>void addBook()}>
          <Plus className="mr-1 h-4 w-4"/>Agregar
        </Button>
      </div>
      {isBibleBook(title)&&books.some((book:any)=>isBibleBook(book.title))&&<p className="text-xs text-muted-foreground">La Biblia ya está en tu biblioteca.</p>}
    </div>}

    {books.length===0&&!q.isError&&<div className="glass max-w-xl rounded-2xl p-4 text-sm text-muted-foreground">Tu biblioteca está vacía. Agrega un libro para registrar páginas, resúmenes y notas.</div>}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {books.map((book:any)=><BookCard
        key={book.id}
        book={book}
        notes={notes.data||[]}
        onSave={(patch:any)=>m.update.mutateAsync({id:book.id,patch})}
        onDelete={()=>m.remove.mutateAsync(book.id)}
        onAddNote={(patch:any)=>nm.create.mutateAsync({...patch,user_id:user?.id})}
      />)}
    </div>
  </section>;
}

function BookCard({book,notes,onSave,onDelete,onAddNote}:{book:any;notes:any[];onSave:(p:any)=>Promise<unknown>;onDelete:()=>Promise<unknown>;onAddNote:(p:any)=>Promise<unknown>}){
  const isBible=isBibleBook(String(book.title||""));
  const total=Number(book.total_pages)||0;
  const[page,setPage]=useState(String(book.current_page||0));
  const[summary,setSummary]=useState(book.summary||"");
  const[note,setNote]=useState("");
  const[section,setSection]=useState("");
  const[noteTitle,setNoteTitle]=useState("");
  const[range,setRange]=useState("");
  const[panel,setPanel]=useState<"progress"|"summary"|"notes"|"bible"|null>(null);
  const[editingSummary,setEditingSummary]=useState(false);
  const[addingNote,setAddingNote]=useState(false);
  const[uploadingCover,setUploadingCover]=useState(false);
  const coverInput=useRef<HTMLInputElement>(null);
  const mine=notes.filter(n=>n.learning_item_id===book.id);
  const coverQuery=usePrivatePhotos(book.cover_path?[String(book.cover_path)]:[],Boolean(book.cover_path));
  const coverUrl=coverQuery.data?.find(item=>item.path===book.cover_path)?.url;
  const pageValue=Math.max(0,Number(page)||0);
  const progress=total?Math.min(100,Math.max(0,pageValue/total*100)):Number(book.progress)||0;
  const remain=Math.max(0,total-pageValue);

  useEffect(()=>setPage(String(book.current_page||0)),[book.current_page]);
  useEffect(()=>setSummary(book.summary||""),[book.summary]);

  const togglePanel=(next:"progress"|"summary"|"notes"|"bible")=>{
    setPanel(current=>current===next?null:next);
    if(next!=="summary")setEditingSummary(false);
    if(next!=="notes")setAddingNote(false);
  };

  const uploadCover=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const input=event.currentTarget;
    const file=input.files?.[0];
    if(!file)return;
    setUploadingCover(true);
    try{
      const path=await privateMediaService.uploadPhoto(file);
      try{
        await onSave({cover_path:path});
      }catch(error){
        await privateMediaService.removePhoto(path).catch(()=>undefined);
        throw error;
      }
      if(book.cover_path&&book.cover_path!==path){
        await privateMediaService.removePhoto(String(book.cover_path)).catch(()=>undefined);
      }
      toast.success("Portada actualizada.");
    }catch(error){
      toast.error(error instanceof Error?error.message:"No se pudo guardar la portada.");
    }finally{
      setUploadingCover(false);
      input.value="";
    }
  };

  const saveProgress=async()=>{
    const nextPage=total?Math.min(total,pageValue):pageValue;
    const nextProgress=total?Math.min(100,Math.max(0,nextPage/total*100)):Number(book.progress)||0;
    await onSave({
      current_page:nextPage,
      progress:nextProgress,
      completed_on:total&&nextPage>=total?new Date().toISOString().slice(0,10):null,
    });
    setPage(String(nextPage));
    setPanel(null);
    toast.success("Avance de lectura guardado.");
  };

  const saveSummary=async()=>{
    await onSave({summary});
    setEditingSummary(false);
    toast.success("Resumen guardado.");
  };

  const saveNote=async()=>{
    if(!note.trim())return;
    const parts=range.split("-").map((value:string)=>value.trim()?Number(value):NaN);
    await onAddNote({
      learning_item_id:book.id,
      section_label:section.trim()||null,
      title:noteTitle.trim()||null,
      body:note,
      page_from:Number.isFinite(parts[0])?parts[0]:null,
      page_to:Number.isFinite(parts[1])?parts[1]:null,
    });
    setNote("");
    setSection("");
    setNoteTitle("");
    setRange("");
    setAddingNote(false);
    toast.success("Nota guardada.");
  };

  return <article className="glass overflow-hidden rounded-2xl">
    <div className="flex gap-3 p-3">
      <div className="relative w-[76px] shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-xl border bg-gradient-to-br from-stone-800 via-amber-950 to-slate-950 shadow-sm">
          {coverUrl
            ? <img src={coverUrl} alt={"Portada de "+book.title} className="h-full w-full object-cover"/>
            : <div className={"flex h-full flex-col items-center justify-between p-2 text-center text-white "+(isBible?"bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-950":"")}>
                <BookOpen className="mt-1 h-5 w-5 opacity-80"/>
                <span className="line-clamp-5 break-words text-[10px] font-semibold leading-tight">{book.title}</span>
                <span className="text-[8px] uppercase tracking-[.18em] opacity-65">Mi biblioteca</span>
              </div>}
        </div>
        <button type="button" onClick={()=>coverInput.current?.click()} disabled={uploadingCover} aria-label="Cambiar portada" title="Cargar foto de portada" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border bg-background text-foreground shadow transition hover:bg-accent disabled:opacity-50">
          <ImagePlus className="h-3.5 w-3.5"/>
        </button>
        <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" className="sr-only" onChange={uploadCover}/>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-semibold leading-snug">{book.title}</h3>
            {isBible
              ? <p className="mt-1 text-xs text-muted-foreground">Plan anual o lectura libre</p>
              : <p className="mt-1 text-xs text-muted-foreground">{total ? total + " páginas · " + Math.round(progress) + "% · " + remain + " restantes" : "Sin total de páginas"}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={()=>void onDelete()} aria-label={"Eliminar "+book.title}>
            <Trash2 className="h-4 w-4 text-destructive"/>
          </Button>
        </div>

        {!isBible&&<>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{width:progress+"%"}}/>
          </div>
          {total>0&&progress>=100&&<p className="text-[11px] font-medium text-emerald-600">Lectura completada</p>}
        </>}

        <div className="flex flex-wrap gap-1.5">
          {isBible
            ? <Button size="sm" variant={panel==="bible"?"default":"outline"} onClick={()=>togglePanel("bible")}>
                <BookOpen className="mr-1 h-3.5 w-3.5"/>Plan bíblico {panel==="bible"?<ChevronUp className="ml-1 h-3.5 w-3.5"/>:<ChevronDown className="ml-1 h-3.5 w-3.5"/>}
              </Button>
            : <>
                <Button size="sm" variant={panel==="progress"?"default":"outline"} onClick={()=>togglePanel("progress")}><Save className="mr-1 h-3.5 w-3.5"/>Páginas</Button>
                <Button size="sm" variant={panel==="summary"?"default":"outline"} onClick={()=>togglePanel("summary")}><FileText className="mr-1 h-3.5 w-3.5"/>Resumen</Button>
                <Button size="sm" variant={panel==="notes"?"default":"outline"} onClick={()=>togglePanel("notes")}><NotebookPen className="mr-1 h-3.5 w-3.5"/>Notas ({mine.length})</Button>
              </>}
        </div>
      </div>
    </div>

    {panel==="progress"&&!isBible&&<div className="space-y-2 border-t p-3">
      <p className="text-sm font-medium">Actualizar progreso</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-36 text-xs text-muted-foreground">Página actual
          <Input className="mt-1" type="number" min="0" max={total||undefined} value={page} onChange={e=>setPage(e.target.value)}/>
        </label>
        <Button size="sm" onClick={()=>void saveProgress()}><Save className="mr-1 h-3.5 w-3.5"/>Guardar página</Button>
        {total>0&&<span className="pb-2 text-xs text-muted-foreground">{remain} páginas restantes</span>}
      </div>
    </div>}

    {panel==="summary"&&!isBible&&<div className="space-y-2 border-t p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Resumen general</p>
        <Button size="sm" variant="outline" onClick={()=>setEditingSummary(v=>!v)}>{editingSummary?"Cancelar":summary?"Editar resumen":"Añadir resumen"}</Button>
      </div>
      {editingSummary
        ? <><RichTextEditor value={summary} onChange={setSummary} placeholder="Escribe aquí las ideas principales del libro…" minHeight={100}/><div className="flex justify-end"><Button size="sm" onClick={()=>void saveSummary()}><Save className="mr-1 h-3.5 w-3.5"/>Guardar resumen</Button></div></>
        : summary
          ? <SafeRichText html={summary} className="prose prose-sm dark:prose-invert line-clamp-4 max-w-none"/>
          : <p className="text-sm text-muted-foreground">Todavía no hay un resumen. Puedes escribirlo cuando quieras.</p>}
    </div>}

    {panel==="notes"&&!isBible&&<div className="space-y-3 border-t p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Notas por sección <span className="text-xs font-normal text-muted-foreground">· {mine.length}</span></p>
        <Button size="sm" variant="outline" onClick={()=>setAddingNote(v=>!v)}><Plus className="mr-1 h-3.5 w-3.5"/>{addingNote?"Cerrar":"Añadir nota"}</Button>
      </div>
      {mine.length>0
        ? <div className="space-y-2">{mine.map((n:any)=><div key={n.id} className="rounded-xl border bg-background/60 p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-sm font-medium">{n.title||n.section_label||"Nota"}</p>
              {n.section_label&&n.title&&<span className="text-xs text-muted-foreground">{n.section_label}</span>}
              {(n.page_from||n.page_to)&&<span className="text-[11px] text-muted-foreground">Págs. {n.page_from||"—"}{n.page_to?"–"+n.page_to:""}</span>}
            </div>
            <SafeRichText html={n.body} className="prose prose-sm dark:prose-invert mt-1 max-w-none"/>
          </div>)}</div>
        : <p className="text-sm text-muted-foreground">Todavía no hay notas para este libro.</p>}
      {addingNote&&<div className="space-y-2 rounded-xl border bg-background/50 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Sección / capítulo" value={section} onChange={e=>setSection(e.target.value)}/>
          <Input placeholder="Título (opcional)" value={noteTitle} onChange={e=>setNoteTitle(e.target.value)}/>
          <Input placeholder="Páginas 10-24" value={range} onChange={e=>setRange(e.target.value)}/>
        </div>
        <RichTextEditor value={note} onChange={setNote} placeholder="Escribe una idea, cita o reflexión…" minHeight={100}/>
        <div className="flex justify-end"><Button size="sm" disabled={!note.trim()} onClick={()=>void saveNote()}>Guardar nota</Button></div>
      </div>}
    </div>}

    {panel==="bible"&&isBible&&<div className="border-t p-2 sm:p-3"><BibleReadingPanel learningItemId={book.id}/></div>}
  </article>;
}

function OtherLearning(){const q=useLGList("learning_items");const m=useLGMutations("learning_items");const{user}=useAuth();const[title,setTitle]=useState(""),[kind,setKind]=useState("course"),[notes,setNotes]=useState("");const items=(q.data||[]).filter((x:any)=>x.kind!=="book"&&x.kind!=="language");return <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold">Cursos, podcasts, videos, ajedrez y certificaciones</h2>{q.isError&&<ErrorState message={q.error instanceof Error?q.error.message:"No se pudieron cargar los recursos de aprendizaje."}/>}<div className="grid gap-2 sm:grid-cols-3"><Input placeholder="Qué estudias" value={title} onChange={e=>setTitle(e.target.value)}/><select className="h-10 rounded-md border bg-background px-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="course">Curso</option><option value="podcast">Podcast</option><option value="video">Video</option><option value="chess">Ajedrez</option><option value="certification">Certificación</option></select><Button disabled={!title.trim()} onClick={()=>void m.create.mutateAsync({user_id:user?.id,title:title.trim(),kind,notes:notes||null}).then(()=>setTitle(""))}><Plus className="mr-1 h-4 w-4"/>Agregar</Button></div><RichTextEditor value={notes} onChange={setNotes} placeholder="Objetivo y notas…"/>{items.map((x:any)=><div key={x.id} className="flex items-center gap-2 rounded-xl border p-3"><span className="flex-1"><b>{x.title}</b><span className="ml-2 text-xs text-muted-foreground">{x.kind}</span></span><Button size="icon" variant="ghost" onClick={()=>void m.remove.mutateAsync(x.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</section>}
function Languages(){const q=useLGList("language_profiles");const s=useLGList("learning_sessions","session_date");const m=useLGMutations("language_profiles");const sm=useLGMutations("learning_sessions");const{user}=useAuth();const{date}=useGlobalDate();const[code,setCode]=useState("en"),[locale,setLocale]=useState("en-US"),[level,setLevel]=useState("A1"),[target,setTarget]=useState("B1"),[focus,setFocus]=useState(""),[minutes,setMinutes]=useState(""),[skill,setSkill]=useState("speaking");const selectedProfile=(q.data||[]).find((x:any)=>x.language_code===code&&(x.locale_code===locale||(!x.locale_code&&((LANGS.find((l:any)=>l.code===code)||LANGS[0]).variants[0][0]===locale))))||null;useEffect(()=>{if(selectedProfile){setLevel(selectedProfile.level||"A1");setTarget(selectedProfile.target_level||"B1");setFocus((selectedProfile.focus_areas||[]).join(", "))}else{setLevel("A1");setTarget("B1");setFocus("")}},[code,locale,q.data]);const saveLanguage=async()=>{const lang=(LANGS.find((x:any)=>x.code===code)||LANGS[0]);const patch={language_code:code,language_name:lang.name,locale_code:locale,country_name:(lang.variants.find((x:any)=>x[0]===locale)||["",""])[1],level,target_level:target,focus_areas:focus.split(",").map(x=>x.trim()).filter(Boolean)};const existing=selectedProfile;if(existing)await m.update.mutateAsync({id:existing.id,patch});else await m.create.mutateAsync({user_id:user?.id,...patch});toast.success(existing?"Perfil de idioma actualizado.":"Perfil de idioma guardado.");};const saveSession=async()=>{const value=Number(minutes);if(!Number.isFinite(value)||value<1||value>1440){toast.error("La duración debe estar entre 1 y 1440 minutos.");return}if(!selectedProfile){toast.error("Guarda primero el perfil de este idioma y variante.");return}const session=await sm.create.mutateAsync({user_id:user?.id,session_date:date,minutes:value,activity_type:"language",skill,resource_url:locale});await lifeGraphService.link("learning_session",session.id,"language_profile",selectedProfile.id,"practiced_language",{locale_code:locale,skill});setMinutes("");toast.success("Sesión de aprendizaje registrada.")};return <section className="space-y-4"><div className="glass space-y-3 rounded-2xl p-4"><h2 className="flex items-center gap-1 font-semibold">Idiomas <HelpTip helpKey="learning.languageVariant"/></h2>{(q.isError||s.isError)&&<ErrorState message={q.error instanceof Error?q.error.message:s.error instanceof Error?s.error.message:"No se pudieron cargar idiomas o sesiones."}/>}<div className="grid gap-2 sm:grid-cols-5"><select className="h-10 rounded-md border bg-background px-3" value={code} onChange={e=>{const v=e.target.value;setCode(v);const l=(LANGS.find((x:any)=>x.code===v)||LANGS[0]).variants[0][0];setLocale(l)}}>{LANGS.map((x:any)=><option key={x.code} value={x.code}>{x.name}</option>)}</select><select className="h-10 rounded-md border bg-background px-3" value={locale} onChange={e=>setLocale(e.target.value)}>{(LANGS.find((x:any)=>x.code===code)||LANGS[0]).variants.map((x:any)=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select><select className="h-10 rounded-md border bg-background px-3" value={level} onChange={e=>setLevel(e.target.value)}>{["A1","A2","B1","B2","C1","C2"].map(x=><option key={x}>{x}</option>)}</select><select className="h-10 rounded-md border bg-background px-3" value={target} onChange={e=>setTarget(e.target.value)}>{["A2","B1","B2","C1","C2"].map(x=><option key={x}>{x}</option>)}</select><Input placeholder="Enfoque (hablar, escuchar…)" value={focus} onChange={e=>setFocus(e.target.value)}/><Button onClick={()=>void saveLanguage()} disabled={m.create.isPending||m.update.isPending}><Plus className="mr-1 h-4 w-4"/>{selectedProfile?"Actualizar perfil":"Guardar variante"}</Button></div>{(q.data||[]).map((x:any)=><div key={x.id} className="flex items-center gap-2 rounded-xl border p-3"><span className="flex-1"><b>{x.language_name}</b><span className="ml-2 text-xs text-muted-foreground">Nivel {x.level} · meta {x.target_level||"—"} · {x.country_name||x.locale_code||"variante"} · {(x.focus_areas||[]).join(" · ")}</span></span><span className="text-xs text-muted-foreground">{(s.data||[]).filter((z:any)=>z.resource_url===x.locale_code).length} sesiones</span></div>)}</div><div className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold">Registrar sesión</h2><div className="grid gap-2 sm:grid-cols-4"><select className="h-10 rounded-md border bg-background px-3" value={code} onChange={e=>{const v=e.target.value;setCode(v);setLocale(((LANGS.find((x:any)=>x.code===v)||LANGS[0]).variants[0][0]))}}>{LANGS.map((x:any)=><option key={x.code} value={x.code}>{x.name}</option>)}</select><select className="h-10 rounded-md border bg-background px-3" value={locale} onChange={e=>setLocale(e.target.value)}>{(LANGS.find((x:any)=>x.code===code)||LANGS[0]).variants.map((x:any)=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select><select className="h-10 rounded-md border bg-background px-3" value={skill} onChange={e=>setSkill(e.target.value)}>{["speaking","listening","reading","writing","vocabulary","grammar"].map(x=><option key={x}>{x}</option>)}</select><Input type="number" min="1" max="1440" placeholder="Minutos" value={minutes} onChange={e=>setMinutes(e.target.value)}/><Button disabled={!minutes||!selectedProfile||sm.create.isPending} onClick={()=>void saveSession()}><Save className="mr-1 h-4 w-4"/>{sm.create.isPending?"Guardando…":"Registrar"}</Button></div></div></section>}
