import { useMemo, useState } from "react";
import { BookOpen, Church, HandHeart, Heart, Plus, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { BibleReadingPanel } from "@/components/learning/BibleReadingPanel";
import { useLGList, useLGMutations } from "@/hooks/use-life-graph";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalDate } from "@/hooks/use-global-date";

type SpiritualEntry = {
  id: string;
  entry_date: string;
  kind: string;
  title: string | null;
  content: string | null;
  scripture_reference?: string | null;
  prayer_answered?: boolean | null;
  legacy_completed?: boolean | null;
  legacy_source_log_id?: string | null;
};

const KIND_LABELS: Record<string, string> = {
  prayer: "Oración",
  church: "Asistencia al culto",
  service: "Servicio",
  reflection: "Reflexión",
  gratitude: "Gratitud",
  reading: "Lectura bíblica",
  prophecy: "Profecía",
  fasting: "Ayuno",
};

export function SpiritualityHubPage() {
  const { user } = useAuth();
  const { date } = useGlobalDate();
  const entries = useLGList("spiritual_entries", "entry_date");
  const mutations = useLGMutations("spiritual_entries");
  const books = useLGList("learning_items");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const bible = (books.data ?? []).find((item: any) =>
    item.kind === "book" && ["la biblia", "biblia"].includes(String(item.title ?? "").trim().toLowerCase())
  );
  const rows = (entries.data ?? []) as SpiritualEntry[];
  const grouped = useMemo(() => {
    const groups = new Map<string, SpiritualEntry[]>();
    for (const item of rows) {
      const list = groups.get(item.entry_date) ?? [];
      list.push(item);
      groups.set(item.entry_date, list);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  const save = async (kind: string, title: string, content: string | null = null, scripture_reference: string | null = null) => {
    if (!user?.id) return;
    try {
      await mutations.create.mutateAsync({
        user_id: user.id,
        entry_date: date,
        kind,
        title,
        content,
        scripture_reference,
        prayer_answered: null,
        fasting: kind === "fasting",
      });
      toast.success(kind === "prayer" ? "Oración registrada." : kind === "church" ? "Asistencia registrada." : "Registro guardado.");
      setNote("");
      setReference("");
      setShowNote(false);
    } catch {
      // The mutation hook displays the database error.
    }
  };

  const currentCount = (kind: string) => rows.filter((row) => row.kind === kind).length;

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-4 pb-24">
      <GlobalDateHeader />
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Church className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Espiritualidad</h1>
          <p className="text-sm text-muted-foreground">A tu ritmo, sin rachas ni presiones.</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <article className="glass flex items-center gap-2 rounded-xl p-3">
          <Heart className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0"><p className="text-xl font-semibold tabular-nums">{currentCount("prayer")}</p><p className="text-xs text-muted-foreground">Oraciones</p></div>
        </article>
        <article className="glass flex items-center gap-2 rounded-xl p-3">
          <Church className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0"><p className="text-xl font-semibold tabular-nums">{currentCount("church")}</p><p className="text-xs text-muted-foreground">Cultos</p></div>
        </article>
        <article className="glass flex items-center gap-2 rounded-xl p-3">
          <HandHeart className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0"><p className="text-xl font-semibold tabular-nums">{currentCount("service")}</p><p className="text-xs text-muted-foreground">Servicio</p></div>
        </article>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Hoy · {date}</h2>
          <span className="text-xs text-muted-foreground">Registro rápido</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button className="justify-start gap-2" onClick={() => void save("prayer", "Oración")} disabled={mutations.create.isPending}><Heart className="h-4 w-4" /> Oré</Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => void save("church", "Asistencia al culto")} disabled={mutations.create.isPending}><Church className="h-4 w-4" /> Asistí al culto</Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => void save("service", "Servicio")} disabled={mutations.create.isPending}><HandHeart className="h-4 w-4" /> Serví</Button>
        </div>
        <Button variant="ghost" size="sm" className="px-1" onClick={() => setShowNote((value) => !value)}><Plus className="mr-1 h-4 w-4" /> Reflexión o gratitud</Button>
        {showNote && <div className="space-y-2 rounded-xl border p-3">
          <select id="spiritual-note-kind" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="reflection">
            <option value="reflection">Reflexión</option><option value="gratitude">Gratitud</option><option value="reading">Lectura bíblica libre</option>
          </select>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia bíblica (opcional)" />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Escribe algo (opcional)" />
          <Button size="sm" disabled={mutations.create.isPending} onClick={() => {
            const selector = document.getElementById("spiritual-note-kind") as HTMLSelectElement | null;
            const kind = selector?.value ?? "reflection";
            void save(kind, KIND_LABELS[kind] ?? "Registro", note.trim() || null, reference.trim() || null);
          }}>Guardar</Button>
        </div>}
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Biblia</h2><p className="text-xs text-muted-foreground">Tu lectura y progreso.</p></div></div>
        {books.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : bible ? <BibleReadingPanel learningItemId={bible.id} /> : <p className="text-sm text-muted-foreground">No encontramos «La Biblia» en tu biblioteca. Puedes agregarla desde Aprendizaje.</p>}
        <a href="/biblia" className="inline-flex text-xs text-primary underline underline-offset-4">Abrir plan completo</a>
      </section>

      <section className="space-y-3">
        <Button type="button" variant="outline" className="w-full justify-between rounded-xl" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}>
          <span className="font-medium">Historial espiritual · {rows.length}</span>
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {showHistory && <>
          {entries.isLoading && <p className="text-sm text-muted-foreground">Cargando historial…</p>}
          {entries.isError && <p className="text-sm text-destructive">No se pudo cargar el historial espiritual.</p>}
          {!entries.isLoading && grouped.length === 0 && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Aún no hay registros.</p>}
          {grouped.map(([day, items]) => <article key={day} className="glass space-y-2 rounded-xl p-3">
            <h3 className="text-sm font-semibold">{day}</h3>
            {items.map((item) => {
              const legacy = Boolean(item.legacy_source_log_id);
              return <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <span className="mt-0.5 text-lg" aria-hidden>{item.kind === "prayer" ? "🙏" : item.kind === "church" ? "⛪" : item.kind === "service" ? "🤲" : "📖"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title || KIND_LABELS[item.kind] || item.kind}</p>
                  {item.scripture_reference && <p className="text-xs text-muted-foreground">{item.scripture_reference}</p>}
                  {item.content && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>}
                  {legacy && <p className="mt-1 text-xs text-muted-foreground">Registro histórico</p>}
                  {item.prayer_answered && <p className="mt-1 text-xs text-muted-foreground">Oración respondida</p>}
                </div>
              </div>;
            })}
          </article>)}
        </>}
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> Sin rachas ni penalizaciones. Tu historial sigue guardado.</p>
    </main>
  );
}
