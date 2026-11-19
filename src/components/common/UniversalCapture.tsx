import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, X, Heart, Lightbulb, MessageSquareText, Sparkles, BookOpen, Bookmark, Wallet, Activity, Users, ListChecks, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useJournalMutations } from "@/hooks/use-journal";
import type { JournalEntryInput } from "@/domain/journal";
import { EMOTIONS } from "@/domain/emotions";
import { toast } from "sonner";

type CaptureKind = "thought" | "idea" | "gratitude" | "emotion" | "dream" | "memory" | "finance" | "expense" | "income" | "health" | "habit" | "relationship" | "planning";
const CAPTURE_OPTIONS = [
  { kind: "thought" as const, label: "Pensamiento o nota", description: "Guardar algo que no quieres olvidar.", icon: MessageSquareText },
  { kind: "idea" as const, label: "Idea o proyecto", description: "Capturar algo que quieres desarrollar.", icon: Lightbulb },
  { kind: "emotion" as const, label: "Estado emocional", description: "Registrar cómo te sientes.", icon: Heart },
  { kind: "gratitude" as const, label: "Gratitud", description: "Anotar algo que agradeces.", icon: Sparkles },
  { kind: "dream" as const, label: "Sueño", description: "Guardar un sueño que recuerdes.", icon: BookOpen },
  { kind: "memory" as const, label: "Recuerdo", description: "Guardar un recuerdo importante.", icon: Bookmark },
  { kind: "expense" as const, label: "Nuevo gasto", description: "Abrir directamente el formulario para registrar un gasto.", icon: Wallet },\n  { kind: "income" as const, label: "Nuevo ingreso", description: "Abrir directamente el formulario para registrar un ingreso.", icon: Wallet },
  { kind: "health" as const, label: "Dato de salud", description: "Registrar una medición o dato.", icon: Activity },
  { kind: "habit" as const, label: "Hábito o actividad", description: "Abrir el registro de hábitos.", icon: ListChecks },
  { kind: "relationship" as const, label: "Interacción", description: "Registrar algo relacionado con una persona.", icon: Users },
  { kind: "planning" as const, label: "Tarea o pendiente", description: "Abrir organización y planificación.", icon: Plus },
];

export function UniversalCapture() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { date } = useGlobalDate();
  const mutations = useJournalMutations();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CaptureKind | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [emotion, setEmotion] = useState("");
  const [intensity, setIntensity] = useState(3);
  const [saving, setSaving] = useState(false);

  function reset() {
    setKind(null); setTitle(""); setContent(""); setEmotion(""); setIntensity(3); setSaving(false);
  }

  function choose(next: CaptureKind) {\n    if (next === "expense" || next === "income") {\n      setOpen(false);\n      void navigate({ to: "/finanzas", search: (previous: Record<string, unknown>) => ({ ...previous, capture: next }) } as never);\n      return;\n    }\n    if (["finance", "health", "habit", "relationship", "planning"].includes(next)) {
      setOpen(false);
      const destinations: Partial<Record<CaptureKind, "/finanzas" | "/salud" | "/organizacion" | "/relaciones">> = {
        finance: "/finanzas", health: "/salud", habit: "/organizacion", relationship: "/relaciones", planning: "/organizacion",
      };
      const destination = destinations[next];
      if (destination) void navigate({ to: destination });
      return;
    }
    setKind(next);
  }

  function save() {
    if (!kind || !["thought", "idea", "gratitude", "emotion", "dream", "memory"].includes(kind)) return;
    if (kind === "emotion" && !emotion) { toast.error("Selecciona una emoción."); return; }
    if (kind !== "emotion" && !content.trim()) { toast.error("Escribe algo antes de guardar."); return; }
    const entryType = (kind === "emotion" ? "reflection" : kind) as JournalEntryInput["type"];
    const input: JournalEntryInput = {
      type: entryType,
      title: kind === "emotion" ? "Emoción · " + emotion : title.trim() || null,
      content: content.trim() || "Registro emocional.",
      entry_date: date,
      entry_time: new Date().toTimeString().slice(0, 5),
      mood: kind === "emotion" ? emotion : null,
      notes: kind === "emotion" ? JSON.stringify({ marker: "pos-emotion-v1", intensity }) : null,
      items: kind === "gratitude" ? content.split("\n").map((item) => item.trim()).filter(Boolean) : [],
      photos: [],
    };
    setSaving(true);
    mutations.create.mutate(input, {
      onSuccess: () => { setOpen(false); reset(); },
      onError: () => setSaving(false),
    });
  }

  const quickKind = kind && ["thought", "idea", "gratitude", "emotion", "dream", "memory"].includes(kind);

  return (
    <>
      {pathname !== "/finanzas" && (
        <Button type="button" size="icon" aria-label="Registro universal" title="Registrar rápidamente" onClick={() => { reset(); setOpen(true); }}
          className="fixed bottom-24 right-3 z-40 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6 md:h-14 md:w-14">
          <Plus className="h-6 w-6" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{quickKind ? "Captura rápida" : "¿Qué quieres registrar?"}</DialogTitle>
            <DialogDescription>Un solo punto de entrada para guardar algo o saltar directamente al módulo correspondiente.</DialogDescription>
          </DialogHeader>
          {!quickKind ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {CAPTURE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return <button key={option.kind} type="button" onClick={() => choose(option.kind)}
                  className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary hover:bg-primary/5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0"><span className="block text-sm font-medium">{option.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span></span>
                </button>;
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{CAPTURE_OPTIONS.find((option) => option.kind === kind)?.label}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setKind(null)}><X className="mr-1 h-3.5 w-3.5" />Cambiar</Button>
              </div>
              {kind !== "emotion" && kind !== "gratitude" && <div className="space-y-1.5"><Label>Título (opcional)</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ponle un nombre…" /></div>}
              {kind === "emotion" && <div className="space-y-2"><Label>¿Cómo te sientes?</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{EMOTIONS.map((option) => <button key={option.label} type="button" aria-pressed={emotion === option.label} onClick={() => setEmotion(option.label)} className={"flex items-center gap-2 rounded-lg border p-2 text-left text-sm " + option.tone + (emotion === option.label ? " ring-2 ring-primary ring-offset-2 ring-offset-background" : "")}><span aria-hidden="true">{option.emoji}</span><span>{option.label}</span></button>)}</div><Label>Intensidad: {intensity}/5</Label><Input type="range" min="1" max="5" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></div>}
              {kind === "gratitude" && <p className="text-xs text-muted-foreground">Puedes escribir varios motivos, uno por línea.</p>}
              <div className="space-y-1.5"><Label>{kind === "emotion" ? "Contexto (opcional)" : kind === "gratitude" ? "¿Qué agradeces?" : "Contenido"}</Label><Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} placeholder="Escribe aquí…" /></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setKind(null); setContent(""); setTitle(""); }}>Atrás</Button><Button type="button" onClick={save} disabled={saving || (kind !== "emotion" && !content.trim()) || (kind === "emotion" && !emotion)}><Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : "Guardar"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
