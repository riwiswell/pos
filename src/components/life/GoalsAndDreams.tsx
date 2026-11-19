import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { SafeRichText } from "@/components/common/SafeRichText";
import { ErrorState } from "@/components/common/States";
import { CoverLightbox } from "@/components/learning/CoverLightbox";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useLGList, useLGMutations } from "@/hooks/use-life-graph";
import { usePrivatePhotos } from "@/hooks/use-private-photos";
import { privateMediaService } from "@/services/private-media.service";
import { todayISO } from "@/lib/date";

const GOAL_META_PREFIX = "pos-goal:v1:";
type GoalHistory = { period: string; amount: number; note?: string; source?: string };
type GoalMeta = {
  version: 1;
  target: number | null;
  unit: string;
  period: "annual" | "monthly";
  category: string;
  startValue: number;
  history: GoalHistory[];
  importedFrom?: string;
  derived?: boolean;
};

function readGoalMeta(goal: any): GoalMeta {
  const raw = String(goal?.goal_type ?? "");
  if (raw.startsWith(GOAL_META_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(GOAL_META_PREFIX.length));
      return {
        version: 1,
        target: parsed.target == null ? null : Math.max(0, Number(parsed.target) || 0),
        unit: String(parsed.unit || ""),
        period: parsed.period === "monthly" ? "monthly" : "annual",
        category: String(parsed.category || goal.area || "Personal"),
        startValue: Math.max(0, Number(parsed.startValue) || 0),
        history: Array.isArray(parsed.history)
          ? parsed.history.filter((item: any) => item && typeof item.period === "string" && Number(item.amount) > 0)
              .map((item: any) => ({ period: String(item.period), amount: Number(item.amount), note: item.note ? String(item.note) : undefined, source: item.source ? String(item.source) : undefined }))
          : [],
        importedFrom: parsed.importedFrom ? String(parsed.importedFrom) : undefined,
        derived: parsed.derived === true,
      };
    } catch {
      // Keep older life_goals rows readable even when their goal_type is not a POS goal package.
    }
  }
  return {
    version: 1,
    target: null,
    unit: "",
    period: "annual",
    category: String(goal?.area || "Personal"),
    startValue: 0,
    history: [],
  };
}
function writeGoalMeta(meta: GoalMeta) {
  return GOAL_META_PREFIX + JSON.stringify(meta);
}
function sumHistory(meta: GoalMeta, period?: string) {
  return meta.startValue + meta.history.reduce((sum, item) => sum + (period && item.period !== period ? 0 : item.amount), 0);
}
function progressPercent(value: number, target: number | null) {
  return target && target > 0 ? Math.min(100, Math.max(0, value / target * 100)) : 0;
}
function seededHistory(values: (number | null)[]) {
  return values.flatMap((amount, index) => amount == null ? [] : [{
    period: "2026-" + String(index + 1).padStart(2, "0"),
    amount,
    source: "Planificador 2026.xlsx",
  }]);
}
const PERSONAL_BOOKS = [
  "Enero: Los 5 lenguajes del amor — Gary Chapman",
  "Febrero: El hombre en busca de sentido — Viktor Frankl",
  "Marzo: El arte de la guerra — Sun Tzu",
  "Abril: Roba como un artista — Austin Kleon",
  "Mayo: El camino hacia la riqueza — Benjamín Franklin",
  "Junio: La tregua — Mario Benedetti",
  "Julio: El elemento — Ken Robinson (versión corta)",
  "Agosto: Cartas a un joven poeta — Rainer Maria Rilke",
  "Septiembre: El caballero de la armadura oxidada — Robert Fisher",
  "Octubre: ¿Quién se ha llevado mi queso? — Spencer Johnson",
  "Noviembre: La paradoja — James C. Hunter",
  "Diciembre: El hombre más rico de Babilonia — George S. Clason",
];
const ART_BOOKS = [
  "Enero: La historia del arte — E. H. Gombrich (capítulos 1–7)",
  "Febrero: La historia del arte — E. H. Gombrich (capítulos 8–13)",
  "Marzo: La historia del arte — E. H. Gombrich (capítulos 14–18)",
  "Abril: La historia del arte — E. H. Gombrich (capítulos 19–23)",
  "Mayo: La historia del arte — E. H. Gombrich (capítulos 24–28)",
  "Junio: Aprender a dibujar con el lado derecho del cerebro — Betty Edwards",
  "Julio: Notas de diario — Leonardo da Vinci",
  "Agosto: Punto y línea sobre el plano — Wassily Kandinsky",
  "Septiembre: El ABC de la Bauhaus — Lupton y Miller",
  "Octubre: Modos de ver — John Berger",
  "Noviembre: Interaction of Color — Josef Albers (versión bolsillo)",
  "Diciembre: Escritos de un salvaje — Paul Gauguin",
];
const IMPORTED_GOALS = [
  {
    title: "Recorrer 1.000 km en bicicleta",
    area: "Salud",
    status: "active",
    target_date: "2026-12-31",
    notes: "Esta es la meta que recuerdas como la original: 1.000 km en el año. El Excel guardaba una meta de 1.500 km, pero sus registros mensuales de kilómetros aparecen en cero. Conservamos aquí tu objetivo recordado de 1.000 km; registra el avance que sí alcanzaste al principio del año.",
    meta: { target: 1000, unit: "km", period: "annual", category: "Salud", startValue: 0, history: [], importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Caminar 250 minutos",
    area: "Salud",
    status: "active",
    target_date: "2026-12-31",
    notes: "El Excel plantea 250 minutos para el año. La columna de avance está rotulada de forma inconsistente como kilómetros y contiene 44 registros; no los convertimos a minutos porque la unidad no es verificable.",
    meta: { target: 250, unit: "minutos", period: "annual", category: "Salud", startValue: 0, history: [], importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Leer 2.378 capítulos de la Biblia",
    area: "Espiritualidad",
    status: "active",
    target_date: "2026-12-31",
    notes: "Avance importado: 270 capítulos entre enero y mayo (93 + 84 + 63 + 30 + 0). La celda de total del Excel suma por error los acumulados mensuales y muestra 1.050; usamos la suma de los capítulos mensuales para no inflar el progreso.",
    meta: { target: 2378, unit: "capítulos", period: "annual", category: "Espiritualidad", startValue: 0, history: seededHistory([93, 84, 63, 30, 0]), importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Estudiar Inglés",
    area: "Aprendizaje",
    status: "active",
    target_date: "2026-12-31",
    notes: "Objetivo del Excel: estudiar 6 días al mes. Registros mensuales importados: enero 6, febrero 6, marzo 8, abril 6 y mayo 7 (33 días).",
    meta: { target: 6, unit: "días de estudio", period: "monthly", category: "Idiomas", startValue: 0, history: seededHistory([6, 6, 8, 6, 7]), importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Estudiar Francés",
    area: "Aprendizaje",
    status: "active",
    target_date: "2026-12-31",
    notes: "Objetivo del Excel: estudiar 15 días al mes. Registros mensuales importados: enero 9, febrero 10, marzo 0, abril 0, mayo 0, junio 14 y julio 6 (39 días).",
    meta: { target: 15, unit: "días de estudio", period: "monthly", category: "Idiomas", startValue: 0, history: seededHistory([9, 10, 0, 0, 0, 14, 6]), importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Estudiar Italiano",
    area: "Aprendizaje",
    status: "active",
    target_date: "2026-12-31",
    notes: "Objetivo del Excel: estudiar 8 días al mes. Registros mensuales importados: enero 8 y febrero 6 (14 días).",
    meta: { target: 8, unit: "días de estudio", period: "monthly", category: "Idiomas", startValue: 0, history: seededHistory([8, 6]), importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Estudiar Portugués",
    area: "Aprendizaje",
    status: "active",
    target_date: "2026-12-31",
    notes: "Objetivo del Excel: estudiar 5 días al mes. Registros mensuales importados: enero 6, febrero 5, marzo 23, abril 20, mayo 13 y junio 2 (69 días).",
    meta: { target: 5, unit: "días de estudio", period: "monthly", category: "Idiomas", startValue: 0, history: seededHistory([6, 5, 23, 20, 13, 2]), importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Leer 12 libros personales",
    area: "Aprendizaje",
    status: "active",
    target_date: "2026-12-31",
    notes: "Uno por mes. Lista del Planificador 2026:\n" + PERSONAL_BOOKS.join("\n"),
    meta: { target: 12, unit: "libros", period: "annual", category: "Lectura personal", startValue: 0, history: [], importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Leer 12 libros de estudio de arte",
    area: "Aprendizaje",
    status: "active",
    target_date: "2026-12-31",
    notes: "Uno por mes para estudiar arte. Lista del Planificador 2026:\n" + ART_BOOKS.join("\n"),
    meta: { target: 12, unit: "libros", period: "annual", category: "Estudio de arte", startValue: 0, history: [], importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Intimidad: mínimo 10 días al mes",
    area: "Relaciones",
    status: "active",
    target_date: "2026-12-31",
    notes: "Meta privada del Excel: al menos 10 días al mes. Se importan 8 registros de enero a mayo (3, 1, 0, 2 y 2).",
    meta: { target: 10, unit: "días", period: "monthly", category: "Relaciones", startValue: 0, history: seededHistory([3, 1, 0, 2, 2]), importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Cita / Tiempo de Calidad con Angie",
    area: "Relaciones",
    status: "active",
    target_date: "2026-12-31",
    notes: "El Excel incluye una cita semanal y eventos de tiempo de calidad. Objetivo anual: 52 citas; no importamos citas realizadas porque la agenda contiene principalmente horarios programados.",
    meta: { target: 52, unit: "citas", period: "annual", category: "Relaciones", startValue: 0, history: [], importedFrom: "Planificador 2026.xlsx" },
  },
  {
    title: "Correr / trotar (objetivo pausado)",
    area: "Salud",
    status: "paused",
    target_date: "2026-12-31",
    notes: "Objetivo conservado como referencia histórica. Lo dejamos pausado porque indicaste que tu médico te prohibió correr o trotar. POS no lo contará como objetivo activo ni te recomendará reanudarlo.",
    meta: { target: null, unit: "actividad", period: "annual", category: "Salud", startValue: 0, history: [], importedFrom: "Planificador 2026.xlsx" },
  },
];

export function GoalsPage() {
  const q = useLGList("life_goals");
  const m = useLGMutations("life_goals");
  const { date } = useGlobalDate();
  const seeded = useRef(false);
  const [editing, setEditing] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("Personal");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("veces");
  const [period, setPeriod] = useState<"annual" | "monthly">("annual");
  const [status, setStatus] = useState("active");
  const [deadline, setDeadline] = useState("2026-12-31");
  const [notes, setNotes] = useState("");
  const [contributionFor, setContributionFor] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("1");
  const [contributionNote, setContributionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const monthKey = date.slice(0, 7);

  useEffect(() => {
    if (!q.isSuccess || seeded.current) return;
    seeded.current = true;
    void (async () => {
      try {
        const existing = new Set((q.data || []).map((goal: any) => String(goal.title || "").trim().toLocaleLowerCase("es")));
        let added = 0;
        for (const seed of IMPORTED_GOALS) {
          const key = seed.title.toLocaleLowerCase("es");
          if (existing.has(key)) continue;
          const meta = seed.meta as GoalMeta;
          await m.create.mutateAsync({
            title: seed.title,
            area: seed.area,
            status: seed.status,
            progress: progressPercent(sumHistory(meta), meta.target),
            target_date: seed.target_date,
            notes: seed.notes,
            goal_type: writeGoalMeta(meta),
          });
          existing.add(key);
          added += 1;
        }
        if (added) toast.success("Tus objetivos del Planificador 2026 ya están en POS.");
      } catch (error) {
        seeded.current = false;
        toast.error(error instanceof Error ? "No se pudieron cargar todas las metas: " + error.message : "No se pudieron cargar todas las metas.");
      }
    })();
  }, [q.isSuccess, q.data, m.create.mutateAsync]);

  const resetForm = () => {
    setEditing(null); setTitle(""); setArea("Personal"); setTarget(""); setUnit("veces");
    setPeriod("annual"); setStatus("active"); setDeadline("2026-12-31"); setNotes("");
  };
  const beginEdit = (goal: any) => {
    const meta = readGoalMeta(goal);
    setEditing(goal); setTitle(goal.title || ""); setArea(meta.category || goal.area || "Personal");
    setTarget(meta.target == null ? "" : String(meta.target)); setUnit(meta.unit || "veces");
    setPeriod(meta.period); setStatus(goal.status || "active"); setDeadline(goal.target_date || "");
    setNotes(goal.notes || ""); setContributionFor(null);
  };
  const saveGoal = async () => {
    if (!title.trim()) { toast.error("Escribe el nombre de la meta."); return; }
    const parsedTarget = target.trim() ? Number(target.replace(",", ".")) : null;
    if (target.trim() && (!Number.isFinite(parsedTarget) || Number(parsedTarget) <= 0)) {
      toast.error("La cantidad objetivo debe ser mayor que cero."); return;
    }
    const previousMeta = editing ? readGoalMeta(editing) : {
      version: 1 as const, target: null, unit: "", period: "annual" as const, category: area,
      startValue: 0, history: [] as GoalHistory[],
    };
    const nextMeta: GoalMeta = {
      ...previousMeta,
      target: parsedTarget,
      unit: unit.trim(),
      period,
      category: area.trim() || "Personal",
    };
    const current = sumHistory(nextMeta);
    setSaving(true);
    try {
      const patch = {
        title: title.trim(), area: area.trim() || "Personal", status,
        progress: progressPercent(current, parsedTarget),
        target_date: deadline || null, notes: notes || null, goal_type: writeGoalMeta(nextMeta),
      };
      if (editing) await m.update.mutateAsync({ id: editing.id, patch });
      else await m.create.mutateAsync(patch);
      toast.success(editing ? "Meta actualizada." : "Meta creada.");
      resetForm();
    } catch {
      // The mutation hook shows the persistence error; keep the form intact for correction.
    } finally { setSaving(false); }
  };
  const addContribution = async (goal: any) => {
    const amount = Number(contributionAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Escribe una cantidad mayor que cero."); return; }
    const meta = readGoalMeta(goal);
    const nextMeta: GoalMeta = {
      ...meta,
      history: [...meta.history, { period: monthKey, amount, note: contributionNote.trim() || undefined, source: "POS" }],
    };
    const currentMonth = sumHistory(nextMeta, monthKey);
    const overall = sumHistory(nextMeta);
    const measured = meta.period === "monthly" ? currentMonth : overall;
    try {
      await m.update.mutateAsync({ id: goal.id, patch: { goal_type: writeGoalMeta(nextMeta), progress: progressPercent(measured, meta.target) } });
      setContributionFor(null); setContributionAmount("1"); setContributionNote("");
      toast.success("Avance registrado en " + goal.title + ".");
    } catch {
      // Keep the dialog values so the user can retry.
    }
  };

  const goals = q.data || [];
  const activeGoals = goals.filter((goal: any) => goal.status === "active");
  const pausedGoals = goals.filter((goal: any) => goal.status !== "active");
  const totalReading = goals.filter((goal: any) => /Leer 12 libros/.test(goal.title)).reduce((sum: number, goal: any) => sum + sumHistory(readGoalMeta(goal)), 0);

  return (
    <div className="space-y-4">
      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" /> Objetivos y metas</h2>
            <p className="mt-1 text-xs text-muted-foreground">Define cuánto quieres lograr y registra avances reales. Los datos originales del Planificador 2026 se conservan como punto de partida.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{activeGoals.length} activas</span>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
          <p className="text-sm font-semibold">Lectura 2026 · 24 libros en total</p>
          <p className="mt-1 text-xs text-muted-foreground">12 libros personales + 12 libros de estudio de arte. Registras cada libro terminado como una unidad en su objetivo correspondiente.</p>
          <p className="mt-1 text-xs font-medium tabular-nums">{totalReading.toLocaleString("es-CO")} / 24 libros registrados</p>
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{editing ? "Editar meta" : "Crear una meta"}</h3>
          {editing && <Button size="sm" variant="ghost" onClick={resetForm}><X className="mr-1 h-4 w-4" /> Cancelar</Button>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
            Nombre
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Leer 12 libros" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Área
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={area} onChange={(event) => setArea(event.target.value)}>
              {["Personal", "Salud", "Aprendizaje", "Idiomas", "Lectura personal", "Estudio de arte", "Relaciones", "Espiritualidad", "Trabajo", "Finanzas"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Período
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={period} onChange={(event) => setPeriod(event.target.value as "annual" | "monthly")}>
              <option value="annual">Anual</option><option value="monthly">Mensual</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Cantidad objetivo
            <Input type="number" min="0.01" step="any" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Ej. 1000" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Unidad
            <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="km, minutos, libros…" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Estado
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">Activa</option><option value="paused">Pausada</option><option value="completed">Completada</option><option value="archived">Archivada</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Fecha objetivo
            <Input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </label>
        </div>
        <RichTextEditor value={notes} onChange={setNotes} placeholder="Por qué importa, plan, criterios de éxito o títulos de libros…" />
        <div className="flex justify-end">
          <Button disabled={saving || !title.trim()} onClick={() => void saveGoal()}><Save className="mr-1 h-4 w-4" /> {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear meta"}</Button>
        </div>
      </section>

      {q.isLoading && <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">Cargando tus objetivos…</div>}
      {q.isError && <ErrorState message={q.error instanceof Error ? q.error.message : "No se pudieron cargar las metas."} />}
      <div className="space-y-3">
        {activeGoals.map((goal: any) => {
          const meta = readGoalMeta(goal);
          const annual = sumHistory(meta);
          const monthly = sumHistory(meta, monthKey);
          const measured = meta.period === "monthly" ? monthly : annual;
          const percentage = progressPercent(measured, meta.target);
          const targetLabel = meta.target == null ? "Sin cantidad objetivo" : meta.target.toLocaleString("es-CO") + " " + meta.unit;
          return (
            <article key={goal.id} className="glass space-y-3 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{goal.title}</h3><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{meta.category || goal.area}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.period === "monthly" ? "Meta mensual" : "Meta anual"} · {targetLabel}{goal.target_date ? " · " + goal.target_date : ""}</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">{measured.toLocaleString("es-CO")} / {meta.target == null ? "—" : meta.target.toLocaleString("es-CO")} {meta.unit}</p>
                  {meta.period === "monthly" && <p className="text-[11px] text-muted-foreground">Acumulado 2026: {annual.toLocaleString("es-CO")} {meta.unit}</p>}
                </div>
                <Button size="icon" variant="ghost" title="Editar meta" aria-label={"Editar " + goal.title} onClick={() => beginEdit(goal)}><Pencil className="h-4 w-4" /></Button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: percentage + "%" }} /></div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{percentage.toFixed(1)}% completado</span><span>{Math.max(0, Number(meta.target || 0) - measured).toLocaleString("es-CO")} {meta.unit} restantes</span></div>
              {goal.notes && <SafeRichText html={goal.notes} className="prose prose-sm max-w-none dark:prose-invert" />}
              {meta.history.length > 0 && <div className="rounded-lg border p-2"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Últimos avances</p>{[...meta.history].slice(-4).reverse().map((item, index) => <p key={index} className="text-xs">{item.period} · +{item.amount} {meta.unit}{item.note ? " · " + item.note : ""}{item.source ? " · " + item.source : ""}</p>)}</div>}
              {contributionFor === goal.id ? (
                <div className="space-y-2 rounded-xl border p-3">
                  <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                    <label className="space-y-1 text-xs text-muted-foreground">Cantidad<Input type="number" min="0.01" step="any" value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} /></label>
                    <label className="space-y-1 text-xs text-muted-foreground">Detalle (opcional)<Input value={contributionNote} onChange={(event) => setContributionNote(event.target.value)} placeholder="Ej. Terminé El arte de la guerra" /></label>
                  </div>
                  <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setContributionFor(null)}>Cancelar</Button><Button size="sm" onClick={() => void addContribution(goal)}>Guardar avance</Button></div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setContributionFor(goal.id); setContributionAmount(meta.unit === "libros" || meta.unit === "citas" || meta.unit === "días" || meta.unit === "días de estudio" ? "1" : "1"); setContributionNote(""); }}> <Plus className="mr-1 h-3.5 w-3.5" /> Registrar avance</Button>
              )}
            </article>
          );
        })}
      </div>

      {pausedGoals.length > 0 && (
        <section className="glass space-y-2 rounded-2xl p-4">
          <h3 className="font-semibold">Pausadas, completadas o archivadas</h3>
          {pausedGoals.map((goal: any) => <div key={goal.id} className="flex items-start gap-2 rounded-xl border p-3"><div className="min-w-0 flex-1"><p className="font-medium">{goal.title}</p><p className="text-xs text-muted-foreground">{goal.status === "paused" ? "Pausada" : goal.status === "completed" ? "Completada" : "Archivada"}{goal.target_date ? " · " + goal.target_date : ""}</p>{goal.notes && <SafeRichText html={goal.notes} className="prose prose-xs mt-1 max-w-none dark:prose-invert" />}</div><Button size="icon" variant="ghost" onClick={() => beginEdit(goal)} aria-label={"Editar " + goal.title}><Pencil className="h-4 w-4" /></Button></div>)}
        </section>
      )}
    </div>
  );
}

export function DreamMapPage() {
  const q = useLGList("journal_entries", "entry_date");
  const m = useLGMutations("journal_entries");
  const { date } = useGlobalDate();
  const { user } = useAuth();
  const [editing, setEditing] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadedDuringEdit, setUploadedDuringEdit] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dreams = (q.data || []).filter((entry: any) => entry.type === "dream");
  const paths = useMemo(() => [...dreams.flatMap((dream: any) => Array.isArray(dream.photos) ? dream.photos : []), ...photos].filter((path: string) => typeof path === "string" && path), [dreams, photos]);
  const photoQuery = usePrivatePhotos(paths, paths.length > 0);
  const photoByPath = useMemo(() => new Map((photoQuery.data || []).map((photo: any) => [photo.path, photo.url])), [photoQuery.data]);

  const reset = async (removeNew = true) => {
    if (removeNew && uploadedDuringEdit.length) {
      await Promise.all(uploadedDuringEdit.map((path) => privateMediaService.removePhoto(path).catch(() => undefined)));
    }
    setEditing(null); setTitle(""); setContent(""); setPhotos([]); setUploadedDuringEdit([]);
    if (inputRef.current) inputRef.current.value = "";
  };
  const beginEdit = (dream: any) => {
    setEditing(dream); setTitle(dream.title || ""); setContent(dream.content || "");
    setPhotos(Array.isArray(dream.photos) ? [...dream.photos] : []); setUploadedDuringEdit([]);
  };
  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) added.push(await privateMediaService.uploadPhoto(file));
      setPhotos((current) => [...current, ...added]);
      setUploadedDuringEdit((current) => [...current, ...added]);
      toast.success(added.length === 1 ? "Imagen añadida al Mapa de Sueños." : added.length + " imágenes añadidas al Mapa de Sueños.");
    } catch (error) {
      await Promise.all(added.map((path) => privateMediaService.removePhoto(path).catch(() => undefined)));
      toast.error(error instanceof Error ? error.message : "No se pudieron subir las imágenes.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const saveDream = async () => {
    if (!title.trim() && !content.trim() && photos.length === 0) {
      toast.error("Añade una frase, una descripción o una imagen.");
      return;
    }
    const patch = { type: "dream", title: title.trim() || null, content: content || "", entry_date: editing?.entry_date || date, photos, items: [] };
    try {
      if (editing) {
        await m.update.mutateAsync({ id: editing.id, patch });
        const removed = (Array.isArray(editing.photos) ? editing.photos : []).filter((path: string) => !photos.includes(path));
        await Promise.all(removed.map((path: string) => privateMediaService.removePhoto(path).catch(() => undefined)));
      } else {
        await m.create.mutateAsync({ user_id: user?.id, ...patch });
      }
      await reset(false);
      toast.success(editing ? "Sueño actualizado." : "Sueño guardado en tu mapa.");
    } catch {
      // Keep the text and image references in place so the user can retry.
    }
  };
  const removeDream = async (dream: any) => {
    if (!window.confirm("¿Eliminar este sueño y sus imágenes?")) return;
    try {
      await m.remove.mutateAsync(dream.id);
      await Promise.all((Array.isArray(dream.photos) ? dream.photos : []).map((path: string) => privateMediaService.removePhoto(path).catch(() => undefined)));
      toast.success("Sueño eliminado.");
    } catch {
      // Keep the entry if the delete failed.
    }
  };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-950 via-violet-950 to-slate-950 p-5 text-white shadow-sm">
        <div className="absolute -right-8 -top-8 text-8xl opacity-15">✦</div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-pink-200">Tu visión para el año</p>
          <h2 className="mt-1 text-2xl font-semibold">Mapa de Sueños</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/85">Guarda fotografías, lugares, objetos, frases e ideas que te recuerden por qué quieres avanzar. Este espacio es tuyo: puedes editarlo, completarlo y cambiarlo con el tiempo.</p>
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div><h3 className="font-semibold">{editing ? "Editar sueño" : "Añadir al mapa"}</h3><p className="text-xs text-muted-foreground">Una foto, una frase o una idea pueden convertirse en una meta.</p></div>
          {editing && <Button size="sm" variant="ghost" onClick={() => void reset()}><X className="mr-1 h-4 w-4" /> Cancelar</Button>}
        </div>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título o frase que te inspire…" />
        <RichTextEditor value={content} onChange={setContent} placeholder="¿Qué sueñas? ¿Por qué lo quieres? ¿Cómo te gustaría sentirte al lograrlo?" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}><ImagePlus className="mr-1 h-4 w-4" /> {uploading ? "Subiendo…" : "Añadir fotos"}</Button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" multiple hidden onChange={(event) => void uploadImages(event.target.files)} />
          <span className="text-xs text-muted-foreground">{photos.length} {photos.length === 1 ? "imagen" : "imágenes"} seleccionadas</span>
        </div>
        {photos.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{photos.map((path, index) => {
          const src = photoByPath.get(path);
          return <div key={path} className="relative overflow-hidden rounded-xl border bg-muted">
            {src ? <CoverLightbox src={src} alt="Imagen del Mapa de Sueños" title={title || "Mi sueño"} triggerClassName="aspect-square w-full cursor-zoom-in" imageClassName="h-full w-full object-cover" /> : <div className="aspect-square animate-pulse bg-muted" />}
            <button type="button" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-white" aria-label="Quitar imagen" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}><X className="h-3.5 w-3.5" /></button>
          </div>;
        })}</div>}
        <div className="flex justify-end"><Button disabled={uploading || m.create.isPending || m.update.isPending} onClick={() => void saveDream()}><Save className="mr-1 h-4 w-4" /> {editing ? "Guardar cambios" : "Guardar en mi mapa"}</Button></div>
      </section>

      {q.isError && <ErrorState message={q.error instanceof Error ? q.error.message : "No se pudo cargar el Mapa de Sueños."} />}
      {dreams.length === 0 && !q.isError && <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">Tu mapa está esperando la primera imagen, frase o sueño que quieras conservar.</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dreams.map((dream: any) => <article key={dream.id} className="glass min-w-0 overflow-hidden rounded-2xl">
          {Array.isArray(dream.photos) && dream.photos.length > 0 && <div className="grid grid-cols-2 gap-1 bg-muted p-1">
            {dream.photos.slice(0, 4).map((path: string) => {
              const src = photoByPath.get(path);
              return src ? <CoverLightbox key={path} src={src} alt={dream.title || "Imagen de un sueño"} title={dream.title || "Mi sueño"} triggerClassName="aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-lg" imageClassName="h-full w-full object-cover" /> : <div key={path} className="aspect-[4/3] animate-pulse rounded-lg bg-muted" />;
            })}
          </div>}
          <div className="space-y-2 p-4">
            <div className="flex items-start gap-2"><h3 className="min-w-0 flex-1 font-semibold">{dream.title || "Sueño sin título"}</h3><Button size="icon" variant="ghost" aria-label="Editar sueño" onClick={() => beginEdit(dream)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Eliminar sueño" onClick={() => void removeDream(dream)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
            <SafeRichText html={dream.content} className="prose prose-sm max-w-none dark:prose-invert" />
            <p className="text-[10px] text-muted-foreground">{dream.entry_date}</p>
          </div>
        </article>)}
      </div>
    </div>
  );
}
