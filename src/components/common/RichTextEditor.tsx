import { useEffect,useMemo } from "react";
import { EditorContent,useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import { Bold, Heading2, Italic, List, ListOrdered, Undo2 } from "lucide-react";
export function RichTextEditor({value,onChange,placeholder,disabled,className}:{value:string;onChange:(html:string)=>void;placeholder?:string;disabled?:boolean;className?:string}){
 const extensions=useMemo(()=>[StarterKit.configure({heading:{levels:[1,2,3]}})],[]);
 const editor=useEditor({extensions,content:value||"",editable:!disabled,onUpdate:({editor:e})=>onChange(e.getHTML()),editorProps:{attributes:{class:"min-h-[140px] w-full rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 outline-none focus:ring-1 focus:ring-ring prose prose-sm dark:prose-invert max-w-none"}}});
 useEffect(()=>{if(!editor)return;const next=value||"";if(next!==editor.getHTML())editor.commands.setContent(next,false);editor.setEditable(!disabled)},[editor,value,disabled]);
 if(!editor)return <div className={cn("min-h-[140px] rounded-xl border border-input bg-background",className)}/>;
 return <div className={cn("space-y-2",className)}>{!disabled&&<div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
 <button type="button" className="rounded p-2 hover:bg-accent" onClick={()=>editor.chain().focus().toggleBold().run()} aria-label="Negrita" title="Negrita" aria-pressed={editor.isActive("bold")}><Bold className="h-4 w-4"/></button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleItalic().run()} aria-label="Cursiva" title="Cursiva" aria-pressed={editor.isActive("italic")}><Italic className="h-4 w-4"/></button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()} aria-label="Título" title="Título" aria-pressed={editor.isActive("heading",{level:2})}><Heading2 className="h-4 w-4"/></button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleBulletList().run()} aria-label="Lista con viñetas" title="Lista con viñetas" aria-pressed={editor.isActive("bulletList")}><List className="h-4 w-4"/></button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleOrderedList().run()} aria-label="Lista numerada" title="Lista numerada" aria-pressed={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4"/></button>
 <button type="button" className="ml-auto rounded p-2 hover:bg-accent" onClick={()=>editor.chain().focus().undo().run()} aria-label="Deshacer" title="Deshacer"><Undo2 className="h-4 w-4"/></button></div>}<EditorContent editor={editor}/>{placeholder&&!editor.getText().trim()&&<div className="pointer-events-none -mt-[9.5rem] ml-3 pb-[9.5rem] text-sm text-muted-foreground">{placeholder}</div>}</div>;
}