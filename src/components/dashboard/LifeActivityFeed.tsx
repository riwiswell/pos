import { Activity, BookOpen, BriefcaseBusiness, HeartPulse, Link2, NotebookPen, Sparkles, Target, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLGEventsByDate } from "@/hooks/use-life-graph";

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
  routine_logs: "routine_log",
  health_metrics: "health_metric",
  journal_entries: "journal_entry",
  work_items: "work_item",
  work_sessions: "work_session",
  learning_sessions: "learning_session",
  learning_items: "learning_item",
  relationship_interactions: "relationship_interaction",
  spiritual_entries: "spiritual_entry",
  life_goals: "life_goal",
};

const RELATED_EVENT_ENTITIES: Record<string, Array<[string, string]>> = {
  habit_logs: [["habit_id", "habit"]],
  routine_logs: [["routine_id", "routine"]],
  work_sessions: [["work_item_id", "work_item"]],
  learning_sessions: [["learning_item_id", "learning_item"]],
  relationship_interactions: [["relationship_id", "relationship"]],
  work_items: [
    ["parent_work_item_id", "work_item"],
    ["source_journal_entry_id", "journal_entry"],
  ],
};

function hasTypedConnection(event: LifeEvent, connections: LifeConnection[]) {
  if (!event.entity_id || !event.entity_type) return false;
  const type = LINK_ENTITY_TYPE[event.entity_type] ?? event.entity_type;
  const payload = event.payload ?? {};
  // Events belong to individual activity rows, but users often connect the
  // reusable parent (habit, routine, project, book or relationship) to a goal.
  // Resolve those parent IDs as well as the event's own identity.
  const identities: Array<{ id: string; type: string }> = [{ id: event.entity_id, type }];
  for (const [field, relatedType] of RELATED_EVENT_ENTITIES[event.entity_type] ?? []) {
    const relatedId = payload[field];
    if (typeof relatedId === "string" && relatedId.length > 0) {
      identities.push({ id: relatedId, type: relatedType });
    }
  }
  return connections.some((link) =>
    identities.some(({ id, type: entityType }) =>
      (link.from_id === id && link.from_type === entityType) ||
      (link.to_id === id && link.to_type === entityType)
    )
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

function eventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hora no disponible";
  return new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function LifeActivityFeed({ date, connections, connectionsLoading }: { date:string; connections: LifeConnection[]; connectionsLoading: boolean }) {
  const [open, setOpen] = useState(false);
  const query = useLGEventsByDate(date, open);
  const events = (query.data ?? []) as LifeEvent[];
  const dayLabel = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date + "T12:00:00"));

  return (
    <>
      <section className="rounded-[22px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[.07] via-card to-card px-3.5 py-3 shadow-sm">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-cyan-500">Tu historia conectada</p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Activity className="h-4 w-4 shrink-0 text-cyan-500" />
                Línea de vida
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                <Link2 className="h-3 w-3" />
                {connectionsLoading ? "…" : `${connections.length} conexiones`}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 shrink-0 rounded-xl px-3 text-xs"
            onClick={() => setOpen(true)}
          >
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Ver actividad
          </Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-4 pb-3 pt-5 pr-12 text-left sm:px-5">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-500" />
              Actividad del día
            </DialogTitle>
            <DialogDescription className="capitalize">
              Tus registros del {dayLabel}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-5">
            {query.isLoading ? (
              <div className="space-y-3 py-3">
                <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
              </div>
            ) : query.isError ? (
              <div className="my-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No se pudo cargar la actividad de esta fecha. Cierra la ventana e inténtalo de nuevo.
              </div>
            ) : events.length === 0 ? (
              <div className="my-3 rounded-xl border border-dashed border-border p-5 text-center">
                <Activity className="mx-auto h-6 w-6 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium">Todavía no hay actividad registrada</p>
                <p className="mt-1 text-xs text-muted-foreground">Cuando registres algo en tus módulos, aparecerá aquí.</p>
              </div>
            ) : (
              <>
                <p className="py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {events.length} {events.length === 1 ? "registro" : "registros"}
                </p>
                <div className="divide-y divide-border/70">
                  {events.map((event) => {
                    const domain = DOMAIN[event.entity_type ?? ""] ?? { label: "Personal", icon: Activity, tone: "text-muted-foreground bg-muted" };
                    const Icon = domain.icon;
                    const connected = hasTypedConnection(event, connections);
                    return (
                      <article key={event.id} className="flex min-w-0 items-start gap-3 py-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${domain.tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-sm font-medium">{eventTitle(event)}</p>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{domain.label}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{eventDetail(event)}</p>
                          <span className={`mt-1 inline-flex items-center gap-1 text-[10px] ${connected ? "text-emerald-500" : "text-muted-foreground"}`}>
                            <Link2 className="h-3 w-3" />
                            {connected ? "Conectado" : "En historial"}
                          </span>
                        </div>
                        <time className="shrink-0 pt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
                          {eventDate(event.event_at).replace(/^.*?,?\s*/, "")}
                        </time>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
