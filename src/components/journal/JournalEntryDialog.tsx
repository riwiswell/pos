import { useEffect, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoStrip } from "@/components/finance/PhotoStrip";
import { HelpTip } from "@/components/common/HelpTip";
import { financeService } from "@/services/finance.service";
import { useJournalMutations } from "@/hooks/use-journal";
import {
  DREAM_MOODS,
  JOURNAL_META,
  JOURNAL_TYPES,
  type JournalEntry,
  type JournalEntryInput,
  type JournalType,
} from "@/domain/journal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing entry; otherwise creating. */
  entry: JournalEntry | null;
  defaultDate: string;
  onDelete?: (entry: JournalEntry) => void;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function JournalEntryDialog({ open, onOpenChange, entry, defaultDate, onDelete }: Props) {
  const { create, update } = useJournalMutations();
  const [type, setType] = useState<JournalType | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(entry?.type ?? null);
    setTitle(entry?.title ?? "");
    setContent(entry?.content ?? "");
    setDate(entry?.entry_date ?? defaultDate);
    setTime(entry?.entry_time?.slice(0, 5) ?? (entry ? "" : nowTime()));
    setMood(entry?.mood ?? "");
    setNotes(entry?.notes ?? "");
    setItems(entry?.items.length ? entry.items : [""]);
    setPhotos(entry?.photos ?? []);
  }, [open, entry, defaultDate]);

  const meta = type ? JOURNAL_META[type] : null;
  const saving = create.isPending || update.isPending;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) paths.push(await financeService.uploadPhoto(f));
      setPhotos((p) => [...p, ...paths]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!type) return;
    const cleanItems = items.map((i) => i.trim()).filter(Boolean);
    if (type === "gratitude" ? cleanItems.length === 0 && !content.trim() : !content.trim()) {
      toast.error(type === "gratitude" ? "Agrega al menos un motivo" : "Escribe algo antes de guardar");
      return;
    }
    const input: JournalEntryInput = {
      type,
      title: meta?.quick ? null : title,
      content,
      entry_date: date,
      entry_time: time || null,
      mood: type === "dream" ? mood : null,
      notes: type === "dream" ? notes : null,
      items: type === "gratitude" ? cleanItems : [],
      photos: type === "memory" ? photos : [],
    };
    const done = { onSuccess: () => onOpenChange(false) };
    if (entry) update.mutate({ id: entry.id, input }, done);
    else create.mutate(input, done);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {meta ? `${meta.emoji} ${entry ? "Editar" : "Nuevo"}: ${meta.label}` : "¿Qué quieres registrar?"}
          </DialogTitle>
        </DialogHeader>

        {!type ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {JOURNAL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="glass flex flex-col items-center gap-1 rounded-xl p-3 text-sm hover:ring-2 hover:ring-primary"
              >
                <span className="text-2xl">{JOURNAL_META[t].emoji}</span>
                {JOURNAL_META[t].label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {!meta?.quick && (
              <div className="space-y-1">
                <Label>Título (opcional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            )}

            {type === "gratitude" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Hoy agradezco por… <HelpTip helpKey="journal.gratitude" text="Escribe uno o varios motivos. Cada línea es un motivo distinto." />
                </Label>
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={it}
                      placeholder={`Motivo ${i + 1}`}
                      onChange={(e) => setItems((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                    {items.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => setItems((a) => a.filter((_, j) => j !== i))} aria-label="Quitar motivo">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setItems((a) => [...a, ""])}>
                  <Plus className="mr-1 h-4 w-4" /> Otro motivo
                </Button>
              </div>
            )}

            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                {meta?.contentLabel}
                {type === "memory" && <HelpTip helpKey="journal.memory" text="La fecha es la del recuerdo, no la del día en que lo escribes." />}
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={meta?.placeholder}
                rows={meta?.quick ? 3 : 7}
              />
            </div>

            {type === "dream" && (
              <>
                <div className="space-y-1">
                  <Label>¿Cómo te hizo sentir?</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DREAM_MOODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMood(mood === m ? "" : m)}
                        className={`rounded-full border px-3 py-1 text-xs ${mood === m ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Notas (opcional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
              </>
            )}

            {type === "memory" && (
              <div className="space-y-1.5">
                <PhotoStrip paths={photos} />
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
                    <ImagePlus className="h-4 w-4" /> {uploading ? "Subiendo…" : "Agregar fotos"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addPhotos(e.target.files)} />
                  </Label>
                  {photos.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setPhotos([])}>Quitar fotos</Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{type === "memory" ? "Fecha del recuerdo" : "Fecha"}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Hora (opcional)</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {entry && onDelete ? (
                <Button variant="ghost" className="text-destructive" onClick={() => onDelete(entry)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                </Button>
              ) : !entry ? (
                <Button variant="ghost" onClick={() => setType(null)}>Cambiar tipo</Button>
              ) : <span />}
              <Button onClick={save} disabled={saving || uploading}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}