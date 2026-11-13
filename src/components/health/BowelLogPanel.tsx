import { useEffect, useMemo, useState } from "react";
import { Clock, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/common/States";
import { useGlobalDate } from "@/hooks/use-global-date";
import { usePersonalDateList, usePersonalMutations, usePersonalRecentList } from "@/hooks/use-personal-domains";
import { todayISO } from "@/lib/date";

type BowelLog = {
  id: string;
  log_date: string;
  log_time: string;
  logged_at: string;
  bristol_type: number | null;
  symptoms: string[];
  notes: string | null;
  created_at: string;
};

const BRISTOL_TYPES = [
  [1, "Bolitas duras, separadas"],
  [2, "Alargada y grumosa"],
  [3, "Alargada con grietas"],
  [4, "Lisa y blanda"],
  [5, "Trozos blandos y definidos"],
  [6, "Pastosa, bordes irregulares"],
  [7, "Líquida"],
] as const;

const SYMPTOMS = [
  ["effort", "Esfuerzo al evacuar"],
  ["pain", "Dolor o ardor"],
  ["blood", "Sangre"],
  ["urgency", "Urgencia"],
  ["incomplete", "Sensación de evacuación incompleta"],
] as const;

function currentClock() {
  const now = new Date();
  return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

function bristolLabel(value: number | null) {
  return value ? BRISTOL_TYPES.find(([number]) => number === value)?.[1] ?? "Sin clasificación" : "Sin clasificación";
}

function formatLogDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(value + "T12:00:00"))
    .replace(".", "");
}

function BowelLogCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: BowelLog;
  onEdit: (entry: BowelLog) => void;
  onDelete: (entry: BowelLog) => void;
}) {
  const labels = entry.symptoms
    .map((value) => SYMPTOMS.find(([key]) => key === value)?.[1])
    .filter((value): value is string => Boolean(value));

  return (
    <article className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums">{String(entry.log_time || "").slice(0, 5) || "Hora no indicada"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.bristol_type ? "Tipo " + entry.bristol_type + " · " + bristolLabel(entry.bristol_type) : "Sin clasificación de consistencia"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(entry)} aria-label="Editar registro">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(entry)} aria-label="Eliminar registro">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <span key={label} className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{label}</span>
          ))}
        </div>
      )}
      {entry.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{entry.notes}</p>}
    </article>
  );
}

export function BowelLogPanel() {
  const { date } = useGlobalDate();
  const [logDate, setLogDate] = useState(date);
  const [logTime, setLogTime] = useState(currentClock);
  const [bristol, setBristol] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<BowelLog | null>(null);

  const dayQuery = usePersonalDateList<BowelLog>("health_bowel_logs", "log_date", logDate);
  const historyQuery = usePersonalRecentList<BowelLog>("health_bowel_logs", "log_date", 100);
  const mutations = usePersonalMutations("health_bowel_logs");

  useEffect(() => {
    setLogDate(date);
  }, [date]);

  const dayEntries = useMemo(
    () => [...(dayQuery.data ?? [])].sort((a, b) => String(b.log_time).localeCompare(String(a.log_time)) || b.created_at.localeCompare(a.created_at)),
    [dayQuery.data],
  );
  const recentEntries = (historyQuery.data ?? []).slice(0, 8);

  const resetForm = () => {
    setEditing(null);
    setLogDate(date);
    setLogTime(currentClock());
    setBristol("");
    setSymptoms([]);
    setNotes("");
  };

  const toggleSymptom = (key: string) => {
    setSymptoms((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  };

  const startEdit = (entry: BowelLog) => {
    setEditing(entry);
    setLogDate(entry.log_date);
    setLogTime(String(entry.log_time || "").slice(0, 5));
    setBristol(entry.bristol_type == null ? "" : String(entry.bristol_type));
    setSymptoms(entry.symptoms ?? []);
    setNotes(entry.notes ?? "");
  };

  const save = async () => {
    if (!logDate || !logTime) {
      toast.error("Indica la fecha y la hora del registro.");
      return;
    }
    if (logDate > todayISO()) {
      toast.error("No puedes registrar una fecha futura.");
      return;
    }
    if (notes.length > 2000) {
      toast.error("La nota puede tener máximo 2.000 caracteres.");
      return;
    }

    const loggedAt = new Date(logDate + "T" + logTime + ":00").toISOString();
    const payload = {
      log_date: logDate,
      log_time: logTime,
      logged_at: loggedAt,
      bristol_type: bristol ? Number(bristol) : null,
      symptoms,
      notes: notes.trim() || null,
    };

    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Registro actualizado.");
      } else {
        await mutations.create.mutateAsync(payload);
        toast.success("Ida al baño registrada.");
      }
      setEditing(null);
      setBristol("");
      setSymptoms([]);
      setNotes("");
      setLogDate(date);
      setLogTime(currentClock());
    } catch {
      // The mutation hook reports the database error.
    }
  };

  const remove = async (entry: BowelLog) => {
    const accepted = window.confirm("¿Eliminar este registro de ida al baño?");
    if (!accepted) return;
    try {
      await mutations.remove.mutateAsync(entry.id);
      if (editing?.id === entry.id) resetForm();
      toast.success("Registro eliminado.");
    } catch {
      // The mutation hook reports the database error.
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold">Registro de idas al baño</h2>
        <p className="text-sm text-muted-foreground">
          Seguimiento opcional de frecuencia, consistencia y síntomas. Los registros son privados de tu cuenta.
        </p>
      </div>

      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">{editing ? "Editar registro" : "Registrar ida al baño"}</h3>
            <p className="text-xs text-muted-foreground">Anota solo los datos que te resulten útiles.</p>
          </div>
          {editing && <Button type="button" variant="ghost" size="sm" onClick={resetForm}><X className="mr-1 h-4 w-4" />Cancelar</Button>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Fecha
            <Input type="date" value={logDate} max={todayISO()} onChange={(event) => setLogDate(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Hora
            <span className="relative block">
              <Clock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input type="time" className="pl-9" value={logTime} onChange={(event) => setLogTime(event.target.value)} />
            </span>
          </label>
        </div>

        <label className="block space-y-1 text-xs text-muted-foreground">
          Consistencia (opcional) · Escala de Bristol
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={bristol} onChange={(event) => setBristol(event.target.value)}>
            <option value="">No registrar</option>
            {BRISTOL_TYPES.map(([value, label]) => <option key={value} value={value}>Tipo {value} · {label}</option>)}
          </select>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Síntomas o detalles (todos opcionales)</p>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map(([key, label]) => {
              const selected = symptoms.includes(key);
              return (
                <button type="button" key={key} aria-pressed={selected} onClick={() => toggleSymptom(key)}
                  className={"rounded-full border px-3 py-2 text-xs transition-colors " + (selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block space-y-1 text-xs text-muted-foreground">
          Notas (opcional)
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000}
            placeholder="Por ejemplo, cambios en la rutina, alimentación o algo que quieras recordar…"
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void save()} disabled={mutations.create.isPending || mutations.update.isPending}>
            {editing ? <Save className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
            {editing ? "Guardar cambios" : "Registrar"}
          </Button>
        </div>
      </div>

      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Registros del día</h3>
            <p className="text-xs text-muted-foreground">{formatLogDate(logDate)} · {dayEntries.length} {dayEntries.length === 1 ? "registro" : "registros"}</p>
          </div>
        </div>
        {dayQuery.isError && <ErrorState message={dayQuery.error instanceof Error ? dayQuery.error.message : "No se pudieron cargar los registros."} />}
        {dayEntries.length === 0 && !dayQuery.isError && (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No hay registros para esta fecha.</p>
        )}
        <div className="space-y-2">
          {dayEntries.map((entry) => <BowelLogCard key={entry.id} entry={entry} onEdit={startEdit} onDelete={(value) => void remove(value)} />)}
        </div>
      </div>

      {recentEntries.length > 0 && (
        <div className="rounded-2xl border border-border p-4">
          <h3 className="font-semibold">Fechas recientes</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentEntries.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setLogDate(entry.log_date)}
                className={"rounded-full border px-3 py-1.5 text-xs " + (entry.log_date === logDate ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                {formatLogDate(entry.log_date)} · {String(entry.log_time).slice(0, 5)}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Es un registro personal de seguimiento, no un diagnóstico ni un sustituto de valoración médica.
      </p>
    </section>
  );
}
