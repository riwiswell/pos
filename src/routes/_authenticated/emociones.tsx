import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Save, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useJournalEntries, useJournalMutations } from "@/hooks/use-journal";
import type { JournalEntry } from "@/domain/journal";
import { EMOTIONS, type EmotionLabel } from "@/domain/emotions";

export const Route = createFileRoute("/_authenticated/emociones")({ component: EmotionsPage });

const MARKER = "Emoción ·";

function readIntensity(entry: JournalEntry): number {
  try {
    const data = JSON.parse(entry.notes ?? "{}") as { marker?: string; intensity?: number };
    return data.marker === "pos-emotion-v1" && Number.isFinite(data.intensity)
      ? Math.max(1, Math.min(5, Number(data.intensity)))
      : 3;
  } catch {
    return 3;
  }
}

function emotionEmoji(label: string | null) {
  return EMOTIONS.find((emotion) => emotion.label === label)?.emoji ?? "💭";
}

function EmotionsPage() {
  const { date } = useGlobalDate();
  const entriesQuery = useJournalEntries();
  const mutations = useJournalMutations();
  const [selected, setSelected] = useState<EmotionLabel | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [context, setContext] = useState("");
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [entryDate, setEntryDate] = useState(date);
  const [entryTime, setEntryTime] = useState(() => new Date().toTimeString().slice(0, 5));

  const entries = useMemo(
    () => (entriesQuery.data ?? [])
      .filter((entry) => entry.type === "reflection" && entry.title?.startsWith(MARKER))
      .sort((a, b) => (a.entry_date === b.entry_date
        ? (b.entry_time ?? "").localeCompare(a.entry_time ?? "")
        : b.entry_date.localeCompare(a.entry_date))),
    [entriesQuery.data],
  );

  const lastSevenDays = useMemo(() => {
    const since = new Date(date + "T00:00:00");
    since.setDate(since.getDate() - 6);
    const start = [since.getFullYear(), String(since.getMonth() + 1).padStart(2, "0"), String(since.getDate()).padStart(2, "0")].join("-");
    return entries.filter((entry) => entry.entry_date >= start && entry.entry_date <= date);
  }, [entries, date]);

  const averageIntensity = lastSevenDays.length
    ? lastSevenDays.reduce((sum, entry) => sum + readIntensity(entry), 0) / lastSevenDays.length
    : 0;

  function resetForm() {
    setSelected(null);
    setIntensity(3);
    setContext("");
    setEditing(null);
    setEntryDate(date);
    setEntryTime(new Date().toTimeString().slice(0, 5));
  }

  function editEntry(entry: JournalEntry) {
    setEditing(entry);
    setSelected(EMOTIONS.find((emotion) => emotion.label === entry.mood)?.label ?? null);
    setIntensity(readIntensity(entry));
    setContext(entry.content === "Registro emocional." ? "" : entry.content);
    setEntryDate(entry.entry_date);
    setEntryTime(entry.entry_time?.slice(0, 5) ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveEmotion() {
    if (!selected) {
      toast.error("Elige la emoción que mejor describe cómo te sientes.");
      return;
    }
    const input = {
      type: "reflection" as const,
      title: MARKER + " " + selected,
      content: context.trim() || "Registro emocional.",
      entry_date: entryDate,
      entry_time: entryTime || null,
      mood: selected,
      notes: JSON.stringify({ marker: "pos-emotion-v1", intensity }),
      items: [],
      photos: [],
    };
    if (editing) {
      mutations.update.mutate({ id: editing.id, input }, { onSuccess: resetForm });
    } else {
      mutations.create.mutate(input, { onSuccess: resetForm });
    }
  }

  function removeEntry(entry: JournalEntry) {
    if (!window.confirm("¿Eliminar este registro emocional?")) return;
    mutations.remove.mutate(entry.id, {
      onSuccess: () => {
        if (editing?.id === entry.id) resetForm();
      },
    });
  }

  const saving = mutations.create.isPending || mutations.update.isPending;

  return (
    <div className="space-y-5 pb-24">
      <GlobalDateHeader />
      <header className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
          <Heart className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Emociones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reconoce cómo te sientes, registra lo que influye y observa tu evolución sin juzgarte.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Registros en los últimos 7 días</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{lastSevenDays.length}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Intensidad media registrada</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{lastSevenDays.length ? averageIntensity.toFixed(1) + " / 5" : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{editing ? "Editar registro emocional" : "¿Cómo te sientes ahora?"}</CardTitle>
          <p className="text-sm text-muted-foreground">Puedes registrar más de una vez al día. No hay emociones correctas o incorrectas.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {EMOTIONS.map((emotion) => (
              <button
                key={emotion.label}
                type="button"
                onClick={() => setSelected(emotion.label)}
                aria-pressed={selected === emotion.label}
                className={"rounded-xl border p-3 text-left transition hover:-translate-y-0.5 " + emotion.tone + (selected === emotion.label ? " ring-2 ring-primary ring-offset-2 ring-offset-background" : "")}
              >
                <span className="text-2xl">{emotion.emoji}</span>
                <span className="mt-1 block text-sm font-medium">{emotion.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>¿Qué tan intensa es esta emoción?</Label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setIntensity(value)} aria-pressed={intensity === value}
                  className={"rounded-xl border px-2 py-3 text-center " + (intensity === value ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-muted")}>
                  <span className="block text-lg">{["·", "•", "••", "•••", "••••"][value - 1]}</span>
                  <span className="text-xs">{value}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">1 = muy leve · 5 = muy intensa</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emotion-date">Fecha</Label>
              <Input id="emotion-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emotion-time">Hora</Label>
              <Input id="emotion-time" type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emotion-context">¿Qué pudo influir? (opcional)</Label>
            <Textarea id="emotion-context" value={context} onChange={(event) => setContext(event.target.value)}
              placeholder="Una situación, pensamiento, conversación, recuerdo o simplemente cómo estás…" rows={3} />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {editing && <Button type="button" variant="outline" onClick={resetForm}>Cancelar edición</Button>}
            <Button type="button" onClick={saveEmotion} disabled={saving || !selected}>
              <Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar emoción"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Historial emocional</h2>
          <span className="text-xs text-muted-foreground">{entries.length} registros</span>
        </div>
        {entriesQuery.isLoading ? <p className="text-sm text-muted-foreground">Cargando historial…</p>
          : entriesQuery.isError ? <p className="text-sm text-destructive">No se pudo cargar el historial emocional.</p>
          : entries.length === 0 ? <Card className="border-dashed"><CardContent className="p-6 text-center">
              <span className="text-3xl">🌱</span><p className="mt-2 font-medium">Tu historial comienza aquí</p>
              <p className="mt-1 text-sm text-muted-foreground">Registra cómo te sientes. Con el tiempo podrás reconocer patrones y cambios.</p>
            </CardContent></Card>
          : <div className="space-y-2">
              {entries.slice(0, 30).map((entry) => (
                <Card key={entry.id} className="glass">
                  <CardContent className="flex items-start gap-3 p-3">
                    <span className="text-2xl">{emotionEmoji(entry.mood)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{entry.mood}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Intensidad {readIntensity(entry)}/5</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.entry_date}{entry.entry_time ? " · " + entry.entry_time.slice(0, 5) : ""}</p>
                      {entry.content !== "Registro emocional." && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.content}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => editEntry(entry)}>Editar</Button>
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label="Eliminar registro" onClick={() => removeEntry(entry)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>}
      </section>
      <p className="text-xs text-muted-foreground">
        Este registro sirve para conocerte mejor; no realiza diagnósticos ni sustituye apoyo profesional.
      </p>
    </div>
  );
}
