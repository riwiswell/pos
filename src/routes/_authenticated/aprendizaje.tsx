import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen,Check,ChevronDown,ChevronUp,Clock,FileText,ImagePlus,NotebookPen,Pencil,Plus,Save,Trash2,X } from "lucide-react";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader"; import { HelpTip } from "@/components/common/HelpTip"; import { RichTextEditor } from "@/components/common/RichTextEditor";
import { SafeRichText } from "@/components/common/SafeRichText";
import { ErrorState } from "@/components/common/States";
import { useLGList,useLGMutations } from "@/hooks/use-life-graph"; import { lifeGraphService } from "@/services/life-graph.service"; import { useAuth } from "@/hooks/use-auth"; import { useProfile } from "@/hooks/use-profile"; import { useGlobalDate } from "@/hooks/use-global-date";
import { BibleChapterProgressSummary, BibleReadingPanel } from "@/components/learning/BibleReadingPanel";
import { usePrivatePhotos } from "@/hooks/use-private-photos";
import { privateMediaService } from "@/services/private-media.service";
import { todayISO } from "@/lib/date";
export const Route=createFileRoute("/_authenticated/aprendizaje")({component:LearningPage});
const LANGS=[
 {code:"en",name:"Inglés",variants:[["en-US","Estados Unidos","🇺🇸"],["en-GB","Reino Unido","🇬🇧"]]},
 {code:"it",name:"Italiano",variants:[["it-IT","Italia","🇮🇹"]]},
 {code:"pt",name:"Portugués",variants:[["pt-BR","Brasil","🇧🇷"],["pt-PT","Portugal","🇵🇹"]]},
 {code:"fr",name:"Francés",variants:[["fr-FR","Francia","🇫🇷"],["fr-CA","Canadá","🇨🇦"]]},
];
function localeInfo(locale:string){
  for(const lang of LANGS){
    const variant=lang.variants.find((item:any)=>item[0]===locale);
    if(variant)return {flag:variant[2],country:variant[1],language:lang.name};
  }
  return {flag:"🌐",country:locale||"Variante",language:"Idioma"};
}
function flagForLocale(locale:string){return localeInfo(locale).flag;}
function flagForLanguageProfile(profile:any){
  const fallback=LANGS.find((lang:any)=>lang.code===profile.language_code)?.variants?.[0]?.[0]||"";
  return flagForLocale(profile.locale_code||fallback);
}
type LearningSort = "used_desc" | "used_asc" | "title_asc" | "title_desc" | "recent" | "oldest" | "genre";
const GAME_PLATFORMS = ["PC","PlayStation 5","PlayStation 4","PlayStation 3","Xbox Series X/S","Xbox One","Xbox 360","Nintendo Switch","Steam Deck","Android / iOS","Otra"];
const GAME_GENRES = ["Acción","Aventura","Acción y Aventuras","Mundo abierto","Rol (RPG)","RPG de acción","JRPG","Disparos (FPS)","Disparos en tercera persona","Terror / Survival horror","Sigilo","Plataformas","Carreras","Deportes","Estrategia","Puzles","Simulación","Lucha","Narrativo","Musical","Otro"];
const INITIAL_READING_ORDER = [
  "los 5 lenguajes del amor",
  "el hombre en busca de sentido",
  "roba como un artista",
  "la historia del arte",
  "conceptos fundamentales de la historia del arte",
];
function sortLearningItems(items:any[],sessions:any[],sort:LearningSort){
 const usage=new Map<string,number>(),sessionCounts=new Map<string,number>(),latest=new Map<string,string>();
 for(const session of sessions){const id=String(session.learning_item_id||"");if(!id)continue;usage.set(id,(usage.get(id)||0)+Math.max(0,Number(session.minutes)||0));sessionCounts.set(id,(sessionCounts.get(id)||0)+1);const date=String(session.session_date||session.created_at||"");if(date>String(latest.get(id)||""))latest.set(id,date);}
 return [...items].sort((a,b)=>{
  const aId=String(a.id),bId=String(b.id),aCount=sessionCounts.get(aId)||0,bCount=sessionCounts.get(bId)||0,aMinutes=Math.max(usage.get(aId)||0,Number(a.minutes_total)||0),bMinutes=Math.max(usage.get(bId)||0,Number(b.minutes_total)||0),aProgress=Math.max(0,Number(a.progress)||0),bProgress=Math.max(0,Number(b.progress)||0),aLast=String(latest.get(aId)||a.updated_at||a.created_at||""),bLast=String(latest.get(bId)||b.updated_at||b.created_at||"");
  const names=String(a.title||"").localeCompare(String(b.title||""),"es",{sensitivity:"base",numeric:true});
  const createdA=String(a.created_at||""),createdB=String(b.created_at||"");
  if(sort==="title_asc")return names;
  if(sort==="title_desc")return -names;
  if(sort==="genre")return String(a.genre||"Sin género").localeCompare(String(b.genre||"Sin género"),"es",{sensitivity:"base"})||names;
  if(sort==="used_asc")return aMinutes-bMinutes||aCount-bCount||aProgress-bProgress||names;
  if(sort==="recent")return bLast.localeCompare(aLast)||createdB.localeCompare(createdA)||names;
  if(sort==="oldest"){
   const aPinned=INITIAL_READING_ORDER.indexOf(String(a.title||"").trim().toLocaleLowerCase("es"));
   const bPinned=INITIAL_READING_ORDER.indexOf(String(b.title||"").trim().toLocaleLowerCase("es"));
   if(aPinned!==-1||bPinned!==-1){
    if(aPinned===-1)return 1;
    if(bPinned===-1)return -1;
    if(aPinned!==bPinned)return aPinned-bPinned;
   }
   return createdA.localeCompare(createdB)||names;
  }
  return bMinutes-aMinutes||bCount-aCount||bProgress-aProgress||bLast.localeCompare(aLast)||names;
 });
}
function LearningSortControl({value,onChange,includeGenre=false}:{value:LearningSort;onChange:(value:LearningSort)=>void;includeGenre?:boolean}){return <select aria-label="Ordenar elementos" title="Ordenar elementos" className="h-9 max-w-[148px] rounded-lg border border-input bg-background px-2 text-xs text-foreground" value={value} onChange={event=>onChange(event.target.value as LearningSort)}><option value="used_desc">Más usado</option><option value="used_asc">Menos usado</option>{includeGenre&&<option value="genre">Género</option>}<option value="title_asc">A–Z</option><option value="title_desc">Z–A</option><option value="recent">Más reciente</option><option value="oldest">Más antiguo</option></select>;}
function LearningPage(){
  const[tab,setTab]=useState("books");
  const{data:profile}=useProfile();
  const booksHidden=profile?.hidden_features?.["learning.books"]===true;
  const current=booksHidden&&tab==="books"?"languages":tab;
  const tabsClass=booksHidden?"grid-cols-2":"grid-cols-3";
  return <div className="space-y-5 pb-24">
    <GlobalDateHeader/>
    <div>
      <h1 className="flex items-center gap-2 text-xl font-semibold">Aprendizaje <HelpTip helpKey="learning"/></h1>
      <p className="text-sm text-muted-foreground">Lecturas, idiomas y otros aprendizajes.</p>
    </div>
    <div className={"grid "+tabsClass+" gap-1 rounded-xl border bg-muted/30 p-1"}>
      {!booksHidden&&<button type="button" onClick={()=>setTab("books")} aria-pressed={current==="books"} className={"rounded-lg px-2 py-2 text-sm font-medium transition "+(current==="books"?"bg-background shadow-sm":"text-muted-foreground hover:text-foreground")}>Libros</button>}
      <button type="button" onClick={()=>setTab("languages")} aria-pressed={current==="languages"} className={"rounded-lg px-2 py-2 text-sm font-medium transition "+(current==="languages"?"bg-background shadow-sm":"text-muted-foreground hover:text-foreground")}>Idiomas</button>
      <button type="button" onClick={()=>setTab("other")} aria-pressed={current==="other"} className={"rounded-lg px-2 py-2 text-sm font-medium transition "+(current==="other"?"bg-background shadow-sm":"text-muted-foreground hover:text-foreground")}>Otros</button>
    </div>
    {current==="books"?<Books/>:current==="languages"?<Languages/>:<OtherLearning mode="resources"/>}
  </div>;
}
export function VideoGamesLibrary(){return <OtherLearning mode="games"/>;}

function isBibleBook(title:string){
  const normalized=title.trim().toLowerCase();
  return normalized==="la biblia"||normalized==="biblia";
}

function Books(){
  const q=useLGList("learning_items");
  const notes=useLGList("learning_notes");
  const sessions=useLGList("learning_sessions","session_date");
  const[sort,setSort]=useState<LearningSort>("oldest");
  const m=useLGMutations("learning_items");
  const nm=useLGMutations("learning_notes");
  const{user}=useAuth();
  const[adding,setAdding]=useState(false);
  const[title,setTitle]=useState("");
  const[author,setAuthor]=useState("");
  const[publicationYear,setPublicationYear]=useState("");
  const[pages,setPages]=useState("");
  const[targetPages,setTargetPages]=useState("");
  const books=sortLearningItems((q.data||[]).filter((x:any)=>x.kind==="book"),sessions.data||[],sort);
  const deleteBook=async(book:any)=>{
    if(book.cover_path)await privateMediaService.removePhoto(String(book.cover_path)).catch(()=>undefined);
    await m.remove.mutateAsync(book.id);
  };
  const addBook=async()=>{
    if(!title.trim())return;
    const parsedYear=Number(publicationYear);
    if(publicationYear.trim()&&(!Number.isInteger(parsedYear)||parsedYear<0||parsedYear>3000)){toast.error("El año debe ser un número entero válido.");return;}
    await m.create.mutateAsync({
      user_id:user?.id,
      title:title.trim(),
      author:author.trim()||null,
      publication_year:publicationYear.trim()?parsedYear:null,
      kind:"book",
      total_pages:Number(pages)>0?Number(pages):null,
      target_pages:Number(targetPages)>0?Number(targetPages):null,
      current_page:0,
      progress:0,
    });
    setTitle("");
    setAuthor("");
    setPublicationYear("");
    setPages("");
    setTargetPages("");
    setAdding(false);
    toast.success("Libro agregado a tu biblioteca.");
  };
  return <section className="space-y-3">
    {(q.isError||notes.isError)&&<ErrorState message={q.error instanceof Error?q.error.message:notes.error instanceof Error?notes.error.message:"No se pudieron cargar libros y notas."}/>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold">Mi biblioteca</h2>
        <p className="text-xs text-muted-foreground">Avance de lectura, resúmenes y apuntes.</p>
      </div>
      <div className="flex items-center gap-2"><LearningSortControl value={sort} onChange={setSort}/><Button size="sm" variant={adding?"outline":"default"} onClick={()=>setAdding(v=>!v)}>{adding?"Cerrar":"Agregar"} {adding?<X className="ml-1 h-4 w-4"/>:<Plus className="ml-1 h-4 w-4"/>}</Button></div>
    </div>
    {adding&&<div className="glass max-w-2xl rounded-2xl p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_110px_130px_130px_auto]">
        <Input placeholder="Título del libro" value={title} onChange={e=>setTitle(e.target.value)}/>
        <Input placeholder="Autor" value={author} onChange={e=>setAuthor(e.target.value)}/>
        <Input type="number" min="0" max="3000" placeholder="Año" value={publicationYear} onChange={e=>setPublicationYear(e.target.value)}/>
        <Input type="number" min="1" placeholder="Páginas reales" value={pages} onChange={e=>setPages(e.target.value)}/>
        <Input type="number" min="1" placeholder="Meta páginas" value={targetPages} onChange={e=>setTargetPages(e.target.value)}/>
        <Button disabled={!title.trim()||m.create.isPending||(isBibleBook(title)&&books.some((book:any)=>isBibleBook(book.title)))} onClick={()=>void addBook()}>
          <Plus className="mr-1 h-4 w-4"/>Agregar
        </Button>
      </div>
      {isBibleBook(title)&&books.some((book:any)=>isBibleBook(book.title))&&<p className="mt-2 text-xs text-muted-foreground">La Biblia ya está en tu biblioteca.</p>}
    </div>}
    {books.length===0&&!q.isError&&<div className="glass max-w-xl rounded-2xl p-4 text-sm text-muted-foreground">Tu biblioteca está vacía. Agrega un libro para registrar tu avance.</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {books.map((book:any)=>{
        const bookNotes=(notes.data||[]).filter((entry:any)=>entry.learning_item_id===book.id);
        return <BookCard
          key={book.id}
          book={book}
          notes={bookNotes}
          coverPath={book.cover_path||null}
          onSave={(patch:any)=>m.update.mutateAsync({id:book.id,patch})}
          onDelete={()=>deleteBook(book)}
          onAddNote={(patch:any)=>nm.create.mutateAsync({...patch,user_id:user?.id})}
          onDeleteNote={(id:string)=>nm.remove.mutateAsync(id)}
        />;
      })}
    </div>
  </section>;
}

function BookCard({book,notes,coverPath,onSave,onDelete,onAddNote,onDeleteNote}:{book:any;notes:any[];coverPath:string|null;onSave:(p:any)=>Promise<unknown>;onDelete:()=>Promise<unknown>;onAddNote:(p:any)=>Promise<unknown>;onDeleteNote:(id:string)=>Promise<unknown>}){
  const isBible=isBibleBook(String(book.title||""));
  const total=isBible?1189:(Number(book.total_pages)||0);
  const[page,setPage]=useState(String(book.status==="completed"&&Number(book.total_pages)>0?book.total_pages:book.current_page||0));
  const[summary,setSummary]=useState(book.summary||"");
  const[note,setNote]=useState("");
  const[section,setSection]=useState("");
  const[noteTitle,setNoteTitle]=useState("");
  const[range,setRange]=useState("");
  const[newTitle,setNewTitle]=useState(String(book.title||""));
  const[newAuthor,setNewAuthor]=useState(String(book.author||""));
  const[newPublicationYear,setNewPublicationYear]=useState(String(book.publication_year||""));
  const[newTotal,setNewTotal]=useState(String(book.total_pages||""));
  const[newTargetPages,setNewTargetPages]=useState(String(book.target_pages||""));
  const[panel,setPanel]=useState<"progress"|"summary"|"notes"|"details"|null>(null);
  const[editingSummary,setEditingSummary]=useState(false);
  const[addingNote,setAddingNote]=useState(false);
  const[uploadingCover,setUploadingCover]=useState(false);
  const coverInput=useRef<HTMLInputElement>(null);
  const mine=notes;
  const coverQuery=usePrivatePhotos(coverPath?[coverPath]:[],Boolean(coverPath));
  const coverUrl=coverQuery.data?.find(item=>item.path===coverPath)?.url;
  const pageValue=Math.max(0,Number(page)||0);
  const progress=total?Math.min(100,Math.max(0,pageValue/total*100)):Number(book.progress)||0;
  const remain=Math.max(0,total-pageValue);
  useEffect(()=>setPage(String(book.status==="completed"&&total>0?total:book.current_page||0)),[book.current_page,book.status,total]);
  useEffect(()=>setSummary(book.summary||""),[book.summary]);
  useEffect(()=>setNewTitle(String(book.title||"")),[book.title]);
  useEffect(()=>setNewAuthor(String(book.author||"")),[book.author]);
  useEffect(()=>setNewPublicationYear(String(book.publication_year||"")),[book.publication_year]);
  useEffect(()=>setNewTotal(String(book.total_pages||"")),[book.total_pages]);
  useEffect(()=>setNewTargetPages(String(book.target_pages||"")),[book.target_pages]);

  const uploadCover=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const input=event.currentTarget;
    const file=input.files?.[0];
    if(!file)return;
    setUploadingCover(true);
    try{
      const nextPath=await privateMediaService.uploadPhoto(file);
      try{
        await onSave({cover_path:nextPath});
      }catch(error){
        await privateMediaService.removePhoto(nextPath).catch(()=>undefined);
        const detail=error&&typeof error==="object"&&"message" in error?String((error as any).message):"No se pudo guardar la referencia de la portada.";
        throw new Error(detail);
      }
      if(coverPath&&coverPath!==nextPath)await privateMediaService.removePhoto(coverPath).catch(()=>undefined);
      toast.success("Portada actualizada.");
    }catch(error){
      const detail=error&&typeof error==="object"&&"message" in error?String((error as any).message):"No se pudo subir la portada. Revisa el permiso de almacenamiento e inténtalo de nuevo.";
      toast.error(detail);
    }finally{
      setUploadingCover(false);
      input.value="";
    }
  };

  const saveProgress=async()=>{
    const nextPage=total?Math.min(total,pageValue):pageValue;
    const nextProgress=total?Math.min(100,Math.max(0,nextPage/total*100)):Number(book.progress)||0;
    await onSave({current_page:nextPage,progress:nextProgress,status:total&&nextPage>=total?"completed":"active",completed_on:total&&nextPage>=total?new Date().toISOString().slice(0,10):null});
    setPage(String(nextPage));
    setPanel(null);
    toast.success(isBible?"Avance de capítulos guardado.":"Avance de lectura guardado.");
  };
  const markFinished=async()=>{ if(!total){toast.error("Indica primero el total de páginas en Editar ficha.");setPanel("details");return;} const today=new Date().toISOString().slice(0,10); await onSave({current_page:total,progress:100,status:"completed",completed_on:today}); setPage(String(total)); setPanel(null); toast.success("Libro marcado como terminado."); };
  const saveDetails=async()=>{
    if(!newTitle.trim()){toast.error("El título no puede quedar vacío.");return;}
    const parsedTotal=Number(newTotal);
    if(newTotal.trim()&&(!Number.isInteger(parsedTotal)||parsedTotal<1)){toast.error("El total de páginas debe ser un número entero mayor que cero.");return;}
    const parsedTarget=Number(newTargetPages);
    if(newTargetPages.trim()&&(!Number.isInteger(parsedTarget)||parsedTarget<1)){toast.error("La meta de páginas debe ser un entero mayor que cero.");return;}
    const parsedYear=Number(newPublicationYear);
    if(newPublicationYear.trim()&&(!Number.isInteger(parsedYear)||parsedYear<0||parsedYear>3000)){toast.error("El año debe ser un número entero válido.");return;}
    const patch:any={title:newTitle.trim(),author:newAuthor.trim()||null,publication_year:newPublicationYear.trim()?parsedYear:null,total_pages:newTotal.trim()?parsedTotal:null,target_pages:newTargetPages.trim()?parsedTarget:null};
    // A completed book remains completed when its bibliographic page count is corrected.
    // Keep the recorded reading and percentage aligned with the new total.
    if(book.status==="completed"&&parsedTotal>0){
      patch.current_page=parsedTotal;
      patch.progress=100;
    }
    await onSave(patch);
    setPanel(null);
    toast.success("Libro actualizado.");
  };
  const saveSummary=async()=>{
    await onSave({summary});
    setEditingSummary(false);
    toast.success("Resumen guardado.");
  };
  const saveNote=async()=>{
    if(!note.trim())return;
    const parts=range.split("-").map((value:string)=>value.trim()?Number(value):NaN);
    await onAddNote({learning_item_id:book.id,section_label:section.trim()||null,title:noteTitle.trim()||null,body:note,page_from:Number.isFinite(parts[0])?parts[0]:null,page_to:Number.isFinite(parts[1])?parts[1]:null});
    setNote("");setSection("");setNoteTitle("");setRange("");setAddingNote(false);
    toast.success("Nota guardada.");
  };

  return <article className="glass overflow-hidden rounded-2xl">
    <div className="flex gap-3 p-3">
      <div className="relative w-[76px] shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-xl border bg-gradient-to-br from-stone-800 via-amber-950 to-slate-950 shadow-sm">
          {coverUrl
            ? <img src={coverUrl} alt={"Portada de "+book.title} loading="eager" decoding="sync" className="h-full w-full object-cover"/>
            : <div className={"flex h-full flex-col items-center justify-between p-2 text-center text-white "+(isBible?"bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-950":"")}>
                <BookOpen className="mt-1 h-5 w-5 opacity-80"/>
                <span className="line-clamp-5 break-words text-[10px] font-semibold leading-tight">{book.title}</span>
                <span className="text-[8px] uppercase tracking-[.18em] opacity-65">Mi biblioteca</span>
              </div>}
        </div>
        {!coverPath&&<button type="button" onClick={()=>coverInput.current?.click()} disabled={uploadingCover} aria-label="Agregar portada" title="Agregar portada" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border bg-background text-foreground shadow transition hover:bg-accent disabled:opacity-50"><ImagePlus className="h-3.5 w-3.5"/></button>}
        <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" className="sr-only" onChange={uploadCover}/>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-semibold leading-snug">{book.title}</h3>
            {!isBible&&(book.author||book.publication_year)&&<p className="mt-0.5 text-xs text-muted-foreground">{[book.author,book.publication_year].filter(Boolean).join(" · ")}</p>}
            {isBible?<BibleChapterProgressSummary learningItemId={book.id}/>:<><p className="mt-1 text-xs text-muted-foreground">{total?total+" páginas · "+Math.round(progress)+"% · "+remain+" restantes":"Sin total de páginas"}</p>{Number(book.target_pages)>0&&<p className="mt-1 text-xs text-primary">Meta intermedia: {book.target_pages} páginas · {Math.max(0,Number(book.target_pages)-pageValue)} restantes</p>}</>}
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={()=>void onDelete()} aria-label={"Eliminar "+book.title}>
            <Trash2 className="h-4 w-4 text-destructive"/>
          </Button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:progress+"%"}}/></div>{total>0&&progress>=100&&<p className="text-[11px] font-medium text-emerald-600">{isBible?"Capítulos registrados completos":"Lectura completada"}</p>}
        <div className="flex flex-wrap gap-1.5">
          {isBible?<><a href="/biblia" target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"><BookOpen className="mr-1 h-3.5 w-3.5"/>Abrir Plan Bíblico <span className="ml-1">↗</span></a></>:<>
              <Button size="sm" variant={panel==="progress"?"default":"outline"} onClick={()=>setPanel(panel==="progress"?null:"progress")}><Save className="mr-1 h-3.5 w-3.5"/>Páginas</Button>
              <Button size="sm" variant={book.status==="completed"?"secondary":"outline"} onClick={()=>void markFinished()} disabled={book.status==="completed"}><Check className="mr-1 h-3.5 w-3.5"/> {book.status==="completed"?"Terminado":"Marcar terminado"}</Button>
              <Button size="sm" variant={panel==="summary"?"default":"outline"} onClick={()=>setPanel(panel==="summary"?null:"summary")}><FileText className="mr-1 h-3.5 w-3.5"/>Resumen</Button>
              <Button size="sm" variant={panel==="notes"?"default":"outline"} onClick={()=>setPanel(panel==="notes"?null:"notes")}><NotebookPen className="mr-1 h-3.5 w-3.5"/>Notas ({mine.length})</Button>
              <Button size="sm" variant={panel==="details"?"default":"outline"} onClick={()=>setPanel(panel==="details"?null:"details")}><Pencil className="mr-1 h-3.5 w-3.5"/>Editar ficha</Button>
            </>}
        </div>
      </div>
    </div>

    {panel==="details"&&!isBible&&<div className="space-y-2 border-t bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Editando la ficha de este libro</p><p className="text-xs text-muted-foreground">Modificas su título, autor, año, páginas, meta de lectura y portada. Esto no cambia las páginas que llevas leídas.</p></div><Button size="sm" type="button" variant="outline" onClick={()=>coverInput.current?.click()} disabled={uploadingCover}><ImagePlus className="mr-1 h-3.5 w-3.5"/>{uploadingCover?"Subiendo…":coverPath?"Cambiar portada":"Agregar portada"}</Button></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_110px_130px_130px_auto]">
        <Input aria-label="Título" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/>
        <Input aria-label="Autor" placeholder="Autor" value={newAuthor} onChange={e=>setNewAuthor(e.target.value)}/>
        <Input aria-label="Año de publicación" type="number" min="0" max="3000" placeholder="Año" value={newPublicationYear} onChange={e=>setNewPublicationYear(e.target.value)}/>
        <Input aria-label="Páginas reales" type="number" min="1" placeholder="Páginas reales" value={newTotal} onChange={e=>setNewTotal(e.target.value)}/>
        <Input aria-label="Meta intermedia de páginas" type="number" min="1" placeholder="Meta páginas" value={newTargetPages} onChange={e=>setNewTargetPages(e.target.value)}/>
        <Button size="sm" onClick={()=>void saveDetails()}><Save className="mr-1 h-3.5 w-3.5"/>Guardar</Button>
      </div>
    </div>}

    {panel==="progress"&&<div className="space-y-2 border-t p-3"><p className="text-sm font-medium">{isBible?"Actualizar capítulos leídos":"Actualizar progreso"}</p>{isBible&&<p className="text-xs text-muted-foreground">Escribe el total acumulado de capítulos que has leído en toda la Biblia (de 0 a 1.189). Este dato calcula el porcentaje y los capítulos que te faltan; no modifica los días del plan anual.</p>}<div className="flex flex-wrap items-end gap-2"><label className="w-40 text-xs text-muted-foreground">{isBible?"Total de capítulos leídos":"Página actual"}<Input className="mt-1" type="number" min="0" max={total||undefined} value={page} onChange={e=>setPage(e.target.value)}/></label><Button size="sm" onClick={()=>void saveProgress()}><Save className="mr-1 h-3.5 w-3.5"/>{isBible?"Guardar capítulos":"Guardar página"}</Button>{total>0&&<span className="pb-2 text-xs text-muted-foreground">{remain.toLocaleString("es-CO")} {isBible?"capítulos":"páginas"} restantes</span>}</div></div>}

    {panel==="summary"&&!isBible&&<div className="space-y-2 border-t p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Resumen general</p>
        <Button size="sm" variant="outline" onClick={()=>setEditingSummary(v=>!v)}>{editingSummary?"Cancelar":summary?"Editar resumen":"Añadir resumen"}</Button>
      </div>
      {editingSummary
        ? <><RichTextEditor value={summary} onChange={setSummary} placeholder="Escribe las ideas principales del libro…" minHeight={100}/><div className="flex justify-end"><Button size="sm" onClick={()=>void saveSummary()}><Save className="mr-1 h-3.5 w-3.5"/>Guardar resumen</Button></div></>
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
        ? <div className="space-y-2">{mine.map((entry:any)=><div key={entry.id} className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{entry.title||entry.section_label||"Nota"}</p>
                {entry.section_label&&entry.title&&<span className="text-xs text-muted-foreground">{entry.section_label}</span>}
                {(entry.page_from||entry.page_to)&&<span className="ml-2 text-[11px] text-muted-foreground">Págs. {entry.page_from||"—"}{entry.page_to?"–"+entry.page_to:""}</span>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Eliminar nota" onClick={()=>void onDeleteNote(entry.id)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>
            </div>
            <SafeRichText html={entry.body} className="prose prose-sm dark:prose-invert mt-1 max-w-none"/>
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
  </article>;
}

function kindLabel(kind:string){
  const labels:Record<string,string>={
    course:"Curso",podcast:"Podcast",video:"Video",video_game:"Videojuego",
    game:"Videojuego",chess:"Ajedrez",certification:"Certificación",other:"Otro",
  };
  return labels[kind]||"Otro";
}
function kindIcon(kind:string){
  if(kind==="video_game"||kind==="game")return "🎮";
  if(kind==="podcast")return "🎧";
  if(kind==="video")return "▶️";
  if(kind==="chess")return "♟️";
  if(kind==="certification")return "🏅";
  return "📚";
}

function OtherLearningCard({item,onEdit,onDelete,onSaveCover,onRecordSession,minutesPlayed=0,sessionCount=0}:{item:any;onEdit:()=>void;onDelete:()=>Promise<unknown>;onSaveCover:(path:string)=>Promise<unknown>;onRecordSession:(minutes:number)=>Promise<unknown>;minutesPlayed?:number;sessionCount?:number}){
  const[uploading,setUploading]=useState(false);
  const[recording,setRecording]=useState(false);
  const[sessionMinutes,setSessionMinutes]=useState("30");
  const[savingSession,setSavingSession]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const totalPlayedMinutes=Math.round(minutesPlayed);
  const path=item.cover_path?String(item.cover_path):null;
  const photoQuery=usePrivatePhotos(path?[path]:[],Boolean(path));
  const photoUrl=photoQuery.data?.find(photo=>photo.path===path)?.url;
  const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const element=event.currentTarget;
    const file=element.files?.[0];
    if(!file)return;
    setUploading(true);
    try{
      const nextPath=await privateMediaService.uploadPhoto(file);
      try{await onSaveCover(nextPath);}catch(error){await privateMediaService.removePhoto(nextPath).catch(()=>undefined);throw error;}
      if(path&&path!==nextPath)await privateMediaService.removePhoto(path).catch(()=>undefined);
      toast.success("Portada actualizada.");
    }catch(error){
      const detail=error&&typeof error==="object"&&"message" in error?String((error as any).message):"No se pudo guardar la portada.";
      toast.error(detail);
    }finally{setUploading(false);element.value="";}
  };
  return <article className="glass flex min-w-0 gap-3 overflow-hidden rounded-2xl p-3">
    <div className="relative w-[76px] shrink-0">
      <div className="aspect-[2/3] overflow-hidden rounded-xl border bg-muted shadow-sm">
        {photoUrl?<img src={photoUrl} alt={"Portada de "+item.title} loading="eager" decoding="sync" className="h-full w-full object-cover"/>:
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-800 via-slate-800 to-slate-950 p-2 text-center text-white">
            <span className="text-2xl">{kindIcon(item.kind)}</span><span className="line-clamp-4 break-words text-[10px] font-semibold leading-tight">{item.title}</span>
          </div>}
      </div>
      {!path&&<button type="button" onClick={()=>input.current?.click()} disabled={uploading} aria-label="Agregar portada" title="Agregar portada" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border bg-background text-foreground shadow hover:bg-accent disabled:opacity-50"><ImagePlus className="h-3.5 w-3.5"/></button>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" className="sr-only" onChange={upload}/>
    </div>
    <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
      <div className="min-w-0"><h3 className="line-clamp-2 text-sm font-semibold">{item.title}</h3><p className="text-xs text-muted-foreground">{kindLabel(item.kind)}</p>{(item.kind==="video_game"||item.kind==="game")&&(item.platform||item.genre)&&<p className="mt-1 text-[11px] font-medium text-primary">{[item.platform,item.genre].filter(Boolean).join(" · ")}</p>}{item.goal_description&&<p className="mt-1 text-xs text-primary">Meta: {item.goal_description}{item.goal_date?" · "+item.goal_date:""}</p>}{(item.kind==="video_game"||item.kind==="game")&&<div className="mt-2 space-y-2">
        {Number(item.progress)>0&&<>
          <div className="flex items-center justify-between text-[11px]"><span className="font-medium text-muted-foreground">Progreso de la historia</span><span className="font-semibold tabular-nums">{Math.min(100,Math.max(0,Number(item.progress)||0)).toLocaleString("es-CO",{maximumFractionDigits:1})}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:Math.min(100,Math.max(0,Number(item.progress)||0))+"%"}}/></div><p className="text-[10px] text-muted-foreground">{Number(item.progress)>=100?"Completado":Number(item.progress)>0?"En curso":"Pendiente de iniciar"}</p>
        </>}
        <div className="rounded-xl border border-border/60 bg-muted/25 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-muted-foreground">Tiempo jugado</span>
            <span className="font-semibold tabular-nums">{totalPlayedMinutes>0?(totalPlayedMinutes>=60?Math.floor(totalPlayedMinutes/60)+" h"+(totalPlayedMinutes%60?" "+(totalPlayedMinutes%60)+" min":""):totalPlayedMinutes+" min"):"Sin sesiones"}</span>
          </div>
          {minutesPlayed>0&&Number(item.progress)<=0&&<>
            <div className="mt-2 flex gap-1" aria-label={sessionCount+" sesiones de juego registradas"}>
              {Array.from({length:Math.min(8,sessionCount)},(_,index)=><span key={index} className="h-1.5 flex-1 rounded-full bg-primary/70"/>)}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Actividad registrada · {sessionCount} {sessionCount===1?"sesión":"sesiones"}; la historia aún no tiene porcentaje.</p>
          </>}
          {Number(item.progress)>0&&minutesPlayed===0&&<p className="mt-1 text-[10px] text-muted-foreground">Porcentaje de historia registrado; todavía no hay tiempo de juego anotado.</p>}
        </div>
        {recording?<div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-background/60 p-2">
          <label className="min-w-0 flex-1 text-[11px] text-muted-foreground">Duración
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={sessionMinutes} onChange={event=>setSessionMinutes(event.target.value)}>
              <option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1 h 30 min</option><option value="120">2 horas</option><option value="180">3 horas</option><option value="240">4 horas</option>
            </select>
          </label>
          <Button size="sm" disabled={savingSession} onClick={async()=>{setSavingSession(true);try{await onRecordSession(Number(sessionMinutes));toast.success("Tiempo jugado guardado.");setRecording(false);}catch{/* El hook ya informa el error de guardado. */}finally{setSavingSession(false);}}}>{savingSession?"Guardando…":"Guardar"}</Button>
          <Button size="sm" variant="ghost" disabled={savingSession} onClick={()=>setRecording(false)}>Cancelar</Button>
        </div>:<Button size="sm" variant="outline" className="w-full" onClick={()=>setRecording(true)}><Clock className="mr-1 h-3.5 w-3.5"/>Registrar tiempo jugado</Button>}
      </div>}{item.notes&&<p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{item.notes}</p>}</div>
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5"/>Editar</Button><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={"Eliminar "+item.title} onClick={()=>void onDelete()}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>
    </div>
  </article>;
}
function OtherLearning({mode="resources"}:{mode?:"resources"|"games"}){
  const q=useLGList("learning_items");
  const sessions=useLGList("learning_sessions","session_date");
  const m=useLGMutations("learning_items");
  const sessionMutation=useLGMutations("learning_sessions");
  const[sort,setSort]=useState<LearningSort>("used_desc");
  const[existingGamesUpdated,setExistingGamesUpdated]=useState(false);
  const{user}=useAuth();
  const isGames=mode==="games";
  const[adding,setAdding]=useState(false);
  const[editingId,setEditingId]=useState<string|null>(null);
  const[title,setTitle]=useState("");
  const[kind,setKind]=useState(isGames?"video_game":"course");
  const[notes,setNotes]=useState("");
  const[goalDescription,setGoalDescription]=useState("");
  const[goalDate,setGoalDate]=useState("");
  const[gameProgress,setGameProgress]=useState("0");
  const[platform,setPlatform]=useState("");
  const[genre,setGenre]=useState("");
  const[filter,setFilter]=useState("all");
  const isGameItem=(item:any)=>item.kind==="video_game"||item.kind==="game";
  const allItems=(q.data||[]).filter((item:any)=>item.kind!=="book"&&item.kind!=="language");
  const items=allItems.filter((item:any)=>isGames?isGameItem(item):!isGameItem(item));
  const applyExistingGameDefaults=async()=>{
    if(!isGames||items.length===0)return;
    try{
      await Promise.all(items.map((item:any)=>m.update.mutateAsync({id:item.id,patch:{platform:"PC",genre:"Acción y Aventuras"}})));
      setExistingGamesUpdated(true);
      toast.success("Se actualizaron "+items.length+" juegos actuales: PC · Acción y Aventuras.");
    }catch{
      // La mutación muestra el detalle del error.
    }
  };
  const visibleItems=sortLearningItems(isGames?items:items.filter((item:any)=>filter==="all"||item.kind===filter),sessions.data||[],sort);
  const resetForm=()=>{setTitle("");setKind(isGames?"video_game":"course");setNotes("");setGoalDescription("");setGoalDate("");setGameProgress("0");setPlatform("");setGenre("");setEditingId(null);setAdding(false);};
  const startEdit=(item:any)=>{setTitle(item.title||"");setKind(item.kind==="game"?"video_game":item.kind||"other");setNotes(item.notes||"");setGoalDescription(item.goal_description||"");setGoalDate(item.goal_date||"");setGameProgress(String(item.progress??0));setPlatform(item.platform||"");setGenre(item.genre||"");setEditingId(item.id);setAdding(true);};
  const saveItem=async()=>{
    const isGame=kind==="video_game"||kind==="game";
    if(!title.trim()){toast.error("Escribe el nombre del elemento.");return;}
    const progress=Math.min(100,Math.max(0,Number(gameProgress)||0));
    if(editingId){
      await m.update.mutateAsync({id:editingId,patch:{title:title.trim(),kind,notes:notes.trim()||null,goal_description:isGame?(goalDescription.trim()||null):null,goal_date:isGame?(goalDate||null):null,progress:isGame?progress:undefined,platform:isGame?(platform.trim()||null):null,genre:isGame?(genre.trim()||null):null}});
      toast.success("Elemento actualizado.");
    }else{
      await m.create.mutateAsync({user_id:user?.id,title:title.trim(),kind,notes:notes.trim()||null,status:"active",goal_description:isGame?(goalDescription.trim()||null):null,goal_date:isGame?(goalDate||null):null,progress:isGame?progress:0,platform:isGame?(platform.trim()||null):null,genre:isGame?(genre.trim()||null):null});
      toast.success("Elemento agregado.");
    }
    resetForm();
  };
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">{isGames?"Mi biblioteca de videojuegos":"Otros aprendizajes"}</h2><p className="text-xs text-muted-foreground">{isGames?"Tus juegos activos, tiempo jugado y progreso de cada historia.":"Cursos, podcasts, videos, ajedrez y certificaciones."}</p></div><div className="flex flex-wrap items-center gap-2">
      {isGames&&items.length>0&&!existingGamesUpdated&&items.some((item:any)=>item.platform!=="PC"||item.genre!=="Acción y Aventuras")&&<Button size="sm" variant="outline" onClick={()=>void applyExistingGameDefaults()} title="Solo actualiza los videojuegos ya registrados; los próximos se agregarán sin valores predeterminados.">Actualizar juegos actuales</Button>}
      <LearningSortControl value={sort} onChange={setSort} includeGenre={isGames}/>
      <Button size="sm" onClick={()=>{if(adding)resetForm();else{setEditingId(null);setTitle("");setKind(isGames?"video_game":"course");setNotes("");setGoalDescription("");setGoalDate("");setGameProgress("0");setPlatform("");setGenre("");setAdding(true)}}}>{adding?"Cerrar":"Agregar"} {adding?<X className="ml-1 h-4 w-4"/>:<Plus className="ml-1 h-4 w-4"/>}</Button>
    </div>
    </div>
    {adding&&<div className="glass max-w-2xl space-y-2 rounded-2xl p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_190px_auto]">
        <Input placeholder={isGames?"Nombre del videojuego":"Nombre del curso o recurso"} value={title} onChange={e=>setTitle(e.target.value)}/>
        {!isGames&&<select className="h-10 rounded-md border bg-background px-3 text-sm" value={kind} onChange={e=>setKind(e.target.value)}>
          <option value="course">Curso</option><option value="podcast">Podcast</option><option value="video">Video</option><option value="chess">Ajedrez</option><option value="certification">Certificación</option><option value="other">Otro</option>
        </select>}
        <Button size="sm" disabled={!title.trim()||m.create.isPending||m.update.isPending} onClick={()=>void saveItem()}><Save className="mr-1 h-3.5 w-3.5"/>{editingId?"Guardar":"Agregar"}</Button>
      </div>
      {(isGames||editingId)&&<textarea className="min-h-16 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm" rows={2} placeholder={isGames?"Notas, edición, plataforma o detalles del juego (opcional)":"Notas o descripción (opcional)"} value={notes} onChange={e=>setNotes(e.target.value)}/>}
      {isGames&&<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-muted-foreground">Plataforma
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={platform} onChange={e=>setPlatform(e.target.value)}>
            <option value="">Elegir plataforma</option>
            {platform&&!GAME_PLATFORMS.includes(platform)&&<option value={platform}>{platform}</option>}
            {GAME_PLATFORMS.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Género
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={genre} onChange={e=>setGenre(e.target.value)}>
            <option value="">Elegir género</option>
            {genre&&!GAME_GENRES.includes(genre)&&<option value={genre}>{genre}</option>}
            {GAME_GENRES.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Objetivo<Input className="mt-1" placeholder="Ej. Terminar la historia" value={goalDescription} onChange={e=>setGoalDescription(e.target.value)}/></label>
        <label className="text-xs text-muted-foreground">Fecha objetivo<Input className="mt-1" type="date" value={goalDate} onChange={e=>setGoalDate(e.target.value)}/></label>
        <label className="text-xs text-muted-foreground">Avance (%)<Input className="mt-1" type="number" min="0" max="100" value={gameProgress} onChange={e=>setGameProgress(e.target.value)}/></label>
      </div>}
      {editingId&&<p className="text-xs text-muted-foreground">Puedes actualizar el nombre, la categoría y la descripción.</p>}
    </div>}
    {!isGames&&<div className="flex flex-wrap gap-1.5">
      {[["all","Todos"],["course","Cursos"],["podcast","Podcasts"],["video","Videos"],["chess","Ajedrez"],["certification","Certificaciones"]].map(([value,label])=><button key={value} type="button" onClick={()=>setFilter(value)} className={"rounded-full border px-3 py-1.5 text-xs "+(filter===value?"border-primary bg-primary/10 font-semibold text-primary":"text-muted-foreground hover:bg-accent")}>{label}</button>)}
    </div>}
    {q.isError&&<ErrorState message={q.error instanceof Error?q.error.message:"No se pudieron cargar los recursos de aprendizaje."}/>}
    {visibleItems.length===0&&!q.isError&&<div className="glass rounded-2xl p-4 text-sm text-muted-foreground">{isGames?"Todavía no has agregado videojuegos. Pulsa Agregar para registrar el que estás jugando.":"Todavía no hay elementos en esta categoría. Pulsa Agregar para crear uno."}</div>}
    <div className={isGames?"grid grid-cols-1 gap-3 md:grid-cols-3":"grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      {visibleItems.map((item:any)=>{const itemSessions=(sessions.data||[]).filter((entry:any)=>entry.learning_item_id===item.id);const minutesPlayed=itemSessions.reduce((sum:number,entry:any)=>sum+Math.max(0,Number(entry.minutes)||0),0);return <OtherLearningCard key={item.id} item={item} minutesPlayed={minutesPlayed} sessionCount={itemSessions.length} onEdit={()=>startEdit(item)} onRecordSession={async(minutes:number)=>{await sessionMutation.create.mutateAsync({user_id:user?.id,learning_item_id:item.id,session_date:todayISO(),minutes,notes:"Videojuego: "+item.title});}} onDelete={async()=>{if(item.cover_path)await privateMediaService.removePhoto(String(item.cover_path)).catch(()=>undefined);await m.remove.mutateAsync(item.id);}} onSaveCover={(cover_path:string)=>m.update.mutateAsync({id:item.id,patch:{cover_path}})}/>;}) }
    </div>
  </section>;
}

function FlagIcon({locale}:{locale:string}){
  const country=locale.split("-")[1]||"";
  const common={viewBox:"0 0 30 20",className:"inline-block h-5 w-7 shrink-0 overflow-hidden rounded-[3px] border border-black/10 shadow-sm",role:"img","aria-label":"Bandera "+country};
  if(country==="FR")return <svg {...common}><rect width="10" height="20" fill="#1b3f8b"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ed2939"/></svg>;
  if(country==="IT")return <svg {...common}><rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/></svg>;
  if(country==="BR")return <svg {...common}><rect width="30" height="20" fill="#009b3a"/><path d="M15 2 L27 10 15 18 3 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/></svg>;
  if(country==="PT")return <svg {...common}><rect width="12" height="20" fill="#006600"/><rect x="12" width="18" height="20" fill="#ff0000"/><circle cx="12" cy="10" r="3" fill="#ffdf00"/></svg>;
  if(country==="CA")return <svg {...common}><rect width="7" height="20" fill="#d80621"/><rect x="7" width="16" height="20" fill="#fff"/><rect x="23" width="7" height="20" fill="#d80621"/><path d="M15 4l1.2 3 2-.8-1 2.4 2 1.2-2.5.3.3 2.5-2-1.4-2 1.4.3-2.5-2.5-.3 2-1.2-1-2.4 2 .8Z" fill="#d80621"/></svg>;
  if(country==="GB")return <svg {...common}><rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="5"/><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="2"/><path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="7"/><path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3"/></svg>;
  if(country==="US")return <svg {...common}><rect width="30" height="20" fill="#fff"/>{Array.from({length:7},(_,i)=><rect key={i} y={i*3} width="30" height="1.5" fill="#b22234"/>)}<rect width="13" height="11" fill="#3c3b6e"/>{Array.from({length:3},(_,i)=>Array.from({length:4},(_,j)=><circle key={i+"-"+j} cx={1.5+j*3} cy={1.5+i*3.2} r=".55" fill="#fff"/>))}</svg>;
  return <span className="inline-grid h-5 w-7 shrink-0 place-items-center rounded border text-[9px] font-bold">{country||"?"}</span>;
}
function Languages(){
  const q=useLGList("language_profiles");
  const s=useLGList("learning_sessions","session_date");
  const m=useLGMutations("language_profiles");
  const sm=useLGMutations("learning_sessions");
  const{user}=useAuth();
  const{date}=useGlobalDate();
  const[code,setCode]=useState("en"),[locale,setLocale]=useState("en-US"),[level,setLevel]=useState("A1"),[target,setTarget]=useState("B1"),[focus,setFocus]=useState(""),[minutes,setMinutes]=useState(""),[skill,setSkill]=useState("speaking");
  const selectedProfile=(q.data||[]).find((x:any)=>x.language_code===code&&(x.locale_code===locale||(!x.locale_code&&((LANGS.find((l:any)=>l.code===code)||LANGS[0]).variants[0][0]===locale))))||null;
  useEffect(()=>{if(selectedProfile){setLevel(selectedProfile.level||"A1");setTarget(selectedProfile.target_level||"B1");setFocus((selectedProfile.focus_areas||[]).join(", "))}else{setLevel("A1");setTarget("B1");setFocus("")}},[code,locale,q.data]);
  const saveLanguage=async()=>{
    const lang=(LANGS.find((x:any)=>x.code===code)||LANGS[0]);
    const patch={language_code:code,language_name:lang.name,locale_code:locale,country_name:(lang.variants.find((x:any)=>x[0]===locale)||["",""])[1],level,target_level:target,focus_areas:focus.split(",").map(x=>x.trim()).filter(Boolean)};
    if(selectedProfile)await m.update.mutateAsync({id:selectedProfile.id,patch});
    else await m.create.mutateAsync({user_id:user?.id,...patch});
    toast.success(selectedProfile?"Perfil de idioma actualizado.":"Idioma agregado a tu plan.");
  };
  const saveSession=async()=>{
    const value=Number(minutes);
    if(!Number.isFinite(value)||value<1||value>1440){toast.error("La duración debe estar entre 1 y 1440 minutos.");return;}
    if(!selectedProfile){toast.error("Primero agrega este idioma a tu plan.");return;}
    const session=await sm.create.mutateAsync({user_id:user?.id,session_date:date,minutes:value,activity_type:"language",resource_url:locale});
    await lifeGraphService.link("learning_session",session.id,"language_profile",selectedProfile.id,"practiced_language",{locale_code:locale,skill});
    setMinutes("");toast.success("Sesión registrada en tu historial.");
  };
  const skills:Record<string,string>={speaking:"Conversación",listening:"Escucha",reading:"Lectura",writing:"Escritura",vocabulary:"Vocabulario",grammar:"Gramática"};
  const localeSessions=(s.data||[]).filter((entry:any)=>entry.resource_url===locale);
  const[sort,setSort]=useState<LearningSort>("used_desc");
  const sortedLanguages=[...(q.data||[])].sort((a:any,b:any)=>{const aCount=(s.data||[]).filter((entry:any)=>entry.resource_url===a.locale_code).length,bCount=(s.data||[]).filter((entry:any)=>entry.resource_url===b.locale_code).length;const names=String(a.language_name||"").localeCompare(String(b.language_name||""),"es",{sensitivity:"base"});if(sort==="title_asc")return names;if(sort==="title_desc")return -names;if(sort==="used_asc")return aCount-bCount||names;if(sort==="recent")return String(b.updated_at||b.created_at||"").localeCompare(String(a.updated_at||a.created_at||""))||names;if(sort==="oldest")return String(a.created_at||"").localeCompare(String(b.created_at||""))||names;return bCount-aCount||names;});
  return <section className="space-y-4">
    {(q.isError||s.isError)&&<ErrorState message={q.error instanceof Error?q.error.message:s.error instanceof Error?s.error.message:"No se pudieron cargar idiomas o sesiones."}/>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
      <div className="glass order-2 flex h-full flex-col space-y-3 rounded-2xl p-4">
        <div><h2 className="font-semibold">Agregar o configurar un idioma</h2><p className="text-xs text-muted-foreground">Elige el idioma y su variante regional, define tu nivel actual y tu meta.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">Idioma<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={code} onChange={e=>{const v=e.target.value;setCode(v);setLocale((LANGS.find((x:any)=>x.code===v)||LANGS[0]).variants[0][0]);}}>{LANGS.map((x:any)=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">País / variante<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={locale} onChange={e=>setLocale(e.target.value)}>{(LANGS.find((x:any)=>x.code===code)||LANGS[0]).variants.map((x:any)=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Nivel actual<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={level} onChange={e=>setLevel(e.target.value)}>{["A1","A2","B1","B2","C1","C2"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Meta<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={target} onChange={e=>setTarget(e.target.value)}>{["A2","B1","B2","C1","C2"].map(x=><option key={x}>{x}</option>)}</select></label>
        </div>
        <Input placeholder="Enfoques: hablar, escuchar, vocabulario…" value={focus} onChange={e=>setFocus(e.target.value)}/>
        <Button className="w-full sm:w-auto" onClick={()=>void saveLanguage()} disabled={m.create.isPending||m.update.isPending}><Plus className="mr-1 h-4 w-4"/>{selectedProfile?"Guardar cambios":"Agregar idioma"}</Button>
      </div>

      <div className="glass order-1 flex h-full flex-col space-y-3 rounded-2xl p-4">
        <div><h2 className="font-semibold">Registrar práctica</h2><p className="text-xs text-muted-foreground">Guarda cada sesión para medir tu constancia y tiempo de estudio.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">Idioma<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={code} onChange={e=>{const v=e.target.value;setCode(v);setLocale((LANGS.find((x:any)=>x.code===v)||LANGS[0]).variants[0][0]);}}>{LANGS.map((x:any)=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Variante<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={locale} onChange={e=>setLocale(e.target.value)}>{(LANGS.find((x:any)=>x.code===code)||LANGS[0]).variants.map((x:any)=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Actividad<select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={skill} onChange={e=>setSkill(e.target.value)}>{Object.entries(skills).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Duración (minutos)<Input type="number" min="1" max="1440" placeholder="Ej. 25" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
        </div>
        <Button className="w-full sm:w-auto" disabled={!minutes||!selectedProfile||sm.create.isPending} onClick={()=>void saveSession()}><Save className="mr-1 h-4 w-4"/>{sm.create.isPending?"Guardando…":"Registrar sesión"}</Button>
        {!selectedProfile&&<p className="text-xs text-amber-600">Agrega primero el idioma y la variante para habilitar el registro.</p>}
      </div>
    </div>

    <div className="glass space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Mis idiomas</h2><p className="text-xs text-muted-foreground">Selecciona una tarjeta para editar el nivel y la meta.</p></div><LearningSortControl value={sort} onChange={setSort}/></div>
      {(q.data||[]).length===0?<p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">Todavía no has agregado idiomas. Usa el formulario de arriba para comenzar.</p>:<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{sortedLanguages.map((x:any)=><button type="button" key={x.id} onClick={()=>{setCode(x.language_code);setLocale(x.locale_code||((LANGS.find((l:any)=>l.code===x.language_code)||LANGS[0]).variants[0][0]));}} className={"flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary "+(selectedProfile?.id===x.id?"border-primary bg-primary/5":"bg-background/50")}>
        <FlagIcon locale={x.locale_code||((LANGS.find((l:any)=>l.code===x.language_code)||LANGS[0]).variants[0][0])}/>
        <span className="min-w-0 flex-1"><b className="block text-sm">{x.language_name} · {x.country_name||x.locale_code}</b><span className="text-xs text-muted-foreground">Nivel {x.level} → meta {x.target_level||"—"}</span><span className="block text-[11px] text-muted-foreground">{(x.focus_areas||[]).join(" · ")||"Sin enfoque definido"}</span></span>
        <span className="text-right text-xs text-muted-foreground">{(s.data||[]).filter((z:any)=>z.resource_url===x.locale_code).length}<span className="block">sesiones</span></span>
      </button>)}</div>}
    </div>
    <div className="glass space-y-3 rounded-2xl p-4">
      <div><h2 className="font-semibold">Historial de práctica</h2><p className="text-xs text-muted-foreground">Sesiones registradas para {localeInfo(locale).language} · {localeInfo(locale).country}.</p></div>
      {localeSessions.length===0?<p className="text-sm text-muted-foreground">Aún no hay sesiones para esta variante. Registra la primera arriba.</p>:<div className="space-y-2">{localeSessions.slice(0,12).map((entry:any)=><div key={entry.id} className="flex items-center gap-3 rounded-xl border p-3"><FlagIcon locale={entry.resource_url||locale}/><div className="min-w-0 flex-1"><p className="text-sm font-medium">Práctica de idioma · {entry.minutes} min</p><p className="text-xs text-muted-foreground">{entry.session_date}</p></div><Button size="icon" variant="ghost" aria-label="Eliminar sesión" onClick={()=>void sm.remove.mutateAsync(entry.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</div>}
    </div>
  </section>;
}
