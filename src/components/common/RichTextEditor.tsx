import { useEffect,useMemo } from "react";
import { EditorContent,useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
export function RichTextEditor({value,onChange,placeholder,disabled,className}:{value:string;onChange:(html:string)=>void;placeholder?:string;disabled?:boolean;className?:string}){
 const extensions=useMemo(()=>[StarterKit.configure({heading:{levels:[1,2,3]}})],[]);
 const editor=useEditor({extensions,content:value||"",editable:!disabled,onUpdate:({editor:e})=>onChange(e.getHTML()),editorProps:{attributes:{class:"min-h-[140px] w-full rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 outline-none focus:ring-1 focus:ring-ring prose prose-sm dark:prose-invert max-w-none"}}});
 useEffect(()=>{if(!editor)return;const next=value||"";if(next!==editor.getHTML())editor.commands.setContent(next,false);editor.setEditable(!disabled)},[editor,value,disabled]);
 if(!editor)return <div className={cn("min-h-[140px] rounded-xl border border-input bg-background",className)}/>;
 return <div className={cn("space-y-2",className)}>{!disabled&&<div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleBold().run()}>Negrita</button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleItalic().run()}>Cursiva</button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}>Título</button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleBulletList().run()}>Lista</button>
 <button type="button" className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().toggleOrderedList().run()}>Numerada</button>
 <button type="button" className="ml-auto rounded px-2 py-1 text-xs hover:bg-accent" onClick={()=>editor.chain().focus().undo().run()}>Deshacer</button></div>}<EditorContent editor={editor}/>{placeholder&&!editor.getText().trim()&&<div className="pointer-events-none -mt-[9.5rem] ml-3 pb-[9.5rem] text-sm text-muted-foreground">{placeholder}</div>}</div>;
}