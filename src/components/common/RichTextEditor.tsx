import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Heading2, List, ListOrdered, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { decodeHtmlEntities } from "@/lib/html-text";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: number;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  minHeight = 140,
}: RichTextEditorProps) {
  // Older records may contain HTML escaped as text (&lt;p&gt;...); decode it
  // before giving it to TipTap so legacy notes become formatted paragraphs.
  const normalizedValue = useMemo(() => decodeHtmlEntities(value || ""), [value]);
  const extensions = useMemo(
    () => [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    [],
  );
  const editor = useEditor({
    extensions,
    content: normalizedValue,
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-[140px] w-full rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 outline-none focus:ring-1 focus:ring-ring prose prose-sm dark:prose-invert max-w-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (normalizedValue !== editor.getHTML()) editor.commands.setContent(normalizedValue, false);
    editor.setEditable(!disabled);
  }, [editor, normalizedValue, disabled]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.minHeight = `${Math.max(64, minHeight)}px`;
  }, [editor, minHeight]);

  if (!editor) {
    return (
      <div
        style={{ minHeight: Math.max(64, minHeight) }}
        className={cn("min-h-[140px] rounded-xl border border-input bg-background", className)}
      />
    );
  }

  const buttonClass = (active = false) =>
    cn(
      "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent",
    );

  return (
    <div className={cn("space-y-2", className)}>
      {!disabled && (
        <div role="toolbar" aria-label="Formato del texto" className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
          <button
            type="button"
            title="Negrita"
            aria-label="Negrita"
            aria-pressed={editor.isActive("bold")}
            className={cn(buttonClass(editor.isActive("bold")), "font-bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            N
          </button>
          <button
            type="button"
            title="Cursiva"
            aria-label="Cursiva"
            aria-pressed={editor.isActive("italic")}
            className={cn(buttonClass(editor.isActive("italic")), "font-serif italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            K
          </button>
          <button
            type="button"
            title="Título de nivel 2"
            aria-label="Título de nivel 2"
            aria-pressed={editor.isActive("heading", { level: 2 })}
            className={buttonClass(editor.isActive("heading", { level: 2 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista con viñetas"
            aria-label="Lista con viñetas"
            aria-pressed={editor.isActive("bulletList")}
            className={buttonClass(editor.isActive("bulletList"))}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista numerada"
            aria-label="Lista numerada"
            aria-pressed={editor.isActive("orderedList")}
            className={buttonClass(editor.isActive("orderedList"))}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Deshacer"
            aria-label="Deshacer"
            className={cn(buttonClass(), "ml-auto")}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="relative">
        <EditorContent editor={editor} />
        {placeholder && !editor.getText().trim() && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm leading-6 text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
