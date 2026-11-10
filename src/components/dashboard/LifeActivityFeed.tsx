import { Activity, BookOpen, BriefcaseBusiness, HeartPulse, Link2, NotebookPen, Sparkles, Target, Users } from "lucide-react";
import { useLGRecentEvents } from "@/hooks/use-life-graph";

type LifeEvent = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  event_at: string;
  payload: Record<string, unknown> | null;
};

type LifeConnection = {
  from_id?: string | null;
  to_id?: string | null;
  relation?: string | null;
  from_type?: string | null;
  to_type?: string | null;
};

const DOMAIN: Record<string, { label: string; icon: typeof Activity; tone: string }> = {
  habit_logs: { label: "Hábitos", icon: Target, tone: "text-violet-400 bg-violet-500/10" },
  health_metrics: { label: "Salud", icon: HeartPulse, tone: "text-rose-400 bg-rose-500/10" },
  journal_entries: { label: "Diario", icon: NotebookPen, tone: "text-amber-400 bg-amber-500/10" },
  work_items: { label: "Trabajo", icon: BriefcaseBusiness, tone: "text-sky-400 bg-sky-500/10" },
  work_sessions: { label: "Trabajo", icon: BriefcaseBusiness, tone: "text-sky-400 bg-sky-500/10" },
  learning_sessions: { label: "Aprendizaje", icon: BookOpen, tone: "text-cyan-400 bg-cyan-500/10" },
  learning_items: { label: "Aprendizaje", icon: BookOpen, tone: "text-cyan-400 bg-cyan-500/10" },
  relationship_interactions: { label: "Relaciones", icon: Users, tone: "text-pink-400 bg-pink-500/10" },
  spiritual_entries: { label: "Espiritualidad", icon: Sparkles, tone: "text-amber-400 bg-amber-500/10" },
};

const LINK_ENTITY_TYPE: Record<string, string> = {
  habit_logs: "habit_log",
  health_metrics: "health_metric",
  journal_entries: "journal_entry",
  work_items: "work_item",
  work_sessions: "work_session",
  learning_sessions: "learning_session",
  learning_items: "learning_item",
  relationship_interactions: "relationship_interaction",
  spiritual_entries: "spiritual_entry",
  life_goals: "life_goal",
  routine_logs: "routine_log",
};

function hasTypedConnection(event: LifeEvent, connections: LifeConnection[]) {
  if (!event.entity_id || !event.entity_type) return false;
  const type = LINK_ENTITY_TYPE[event.entity_type] ?? event.entity_type;
  return connections.some((link) =>
    (link.from_id === event.entity_id && link.from_type === type) ||
    (link.to_id === event.entity_id && link.to_type === type)
  );
}

function eventTitle(event: LifeEvent) {
  const payload = event.payload ?? {};
  const title = payload.title ?? payload.name;
  if (typeof title === "string" && title.trim()) return title;
  const domain = DOMAIN[event.entity_type ?? ""];
  if (event.entity_type === "habit_logs") return payload.completed === true || Number(payload.value ?? 0) > 0 ? "Progreso de hábito registrado" : "Registro de hábito actualizado";
  if (event.entity_type === "health_metrics") return "Actualizaste tus datos de salud";
  if (event.entity_type === "journal_entries") return "Escribiste en tu diario";
  if (event.entity_type === "work_sessions") return payload.status === "completed" ? "Completaste una sesión de trabajo" : "Registraste una sesión de trabajo";
  if (event.entity_type === "learning_sessions") return "Registraste una sesión de aprendizaje";
  if (event.entity_type === "relationship_interactions") return "Registraste una interacción";
  return domain ? "Actividad registrada" : "Nuevo acontecimiento";
}

function eventDetail(event: LifeEvent) {
  const payload = event.payload ?? {};
  if (event.entity_type === "health_metrics") {
    const parts: string[] = [];
    if (payload.water_liters != null) parts.push(`Agua: ${Number(payload.water_liters).toLocaleString("es-CO")} L`);
    if (payload.sleep_hours != null) parts.push(`Sueño: ${Number(payload.sleep_hours).toLocaleString("es-CO")} h`);
    if (payload.exercise_minutes != null) parts.push(`Actividad: ${Number(payload.exercise_minutes)} min`);
    return parts.join(" · ") || "Seguimiento de salud";
  }
  if (event.entity_type === "work_sessions" && payload.minutes != null) return `${Number(payload.minutes)} minutos registrados`;
  if (event.entity_type === "learning_sessions" && payload.minutes != null) return `${Number(payload.minutes)} minutos de aprendizaje`;
  if (event.entity_type === "habit_logs" && payload.habit_kind === "activity") return "Actividad personal";
  return event.event_type === "updated" ? "Registro actualizado" : "Añadido a tu historial";
}

function eventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

export function LifeActivityFeed({ connections, connectionsLoading }: { connections: LifeConnection[]; connectionsLoading: boolean }) {
  const query = useLGRecentEvents(6);
  const events = (query.data ?? []) as LifeEvent[];
  return (
    <section className="overflow-hidden rounded-[26px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[.06] via-card to-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-cyan-500">Tu historia conectada</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold"><Activity className="h-4 w-4 text-cyan-500" /> Actividad reciente</h2>
          <p className="mt-1 text-xs text-muted-foreground">Acciones reales de tus módulos, reunidas en una sola línea de vida.</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> {connectionsLoading ? "…" : `${connections.length} conexiones`}
        </div>
      </div>
      {query.isLoading ? <p className="px-4 pb-4 text-sm text-muted-foreground">Cargando tu actividad…</p> :
        query.isError ? <p className="px-4 pb-4 text-sm text-destructive">No se pudo cargar tu línea de vida.</p> :
        events.length === 0 ? <div className="mx-4 mb-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Cuando registres hábitos, salud, aprendizaje o proyectos, sus acontecimientos aparecerán aquí automáticamente.</div> :
        <div className="divide-y divide-border/70 px-4">
          {events.map((event) => {
            const domain = DOMAIN[event.entity_type ?? ""] ?? { label: "Personal", icon: Activity, tone: "text-muted-foreground bg-muted" };
            const Icon = domain.icon;
            const connected = hasTypedConnection(event, connections);
            return (
              <article key={event.id} className="flex items-start gap-3 py-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${domain.tone}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{eventTitle(event)}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{domain.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{eventDetail(event)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">{eventDate(event.event_at)}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 text-[10px] ${connected ? "text-emerald-500" : "text-muted-foreground"}`}>
                    <Link2 className="h-3 w-3" /> {connected ? "Conectado" : "En historial"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      }
    </section>
  );
}
