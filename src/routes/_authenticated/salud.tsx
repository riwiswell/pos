import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, BellOff, Check, Clock, Droplet, History, Pencil, Pill, Plus, SkipForward, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { MedicationDialog } from "@/components/health/MedicationDialog";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useDoseHistory, useDoses, useMedicationMutations, useMedications, useTakenCounts } from "@/hooks/use-medications";
import { getPermission, requestNotificationPermission, type NotifPermission } from "@/hooks/use-medication-reminders";
import { addDaysISO, formatDayLabel, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  DOSE_STATUS_LABEL,
  FREQUENCY_LABEL,
  WATER_OPTIONS,
  doseLabel,
  effectiveDueAt,
  formatGlasses,
  formatTime12,
  isOpen,
  medicationWater,
  remainingQuantity,
  type DoseStatus,
  type Medication,
  type MedicationDose,
} from "@/domain/health";

export const Route = createFileRoute("/_authenticated/salud")({
  head: () => ({
    meta: [
      { title: "Salud · Medicamentos — Personal OS" },
      { name: "description", content: "Medicamentos de hoy, horarios, avisos y registro de tomas." },
      { property: "og:title", content: "Salud · Medicamentos — Personal OS" },
      { property: "og:description", content: "Medicamentos de hoy, horarios, avisos y registro de tomas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

const STATUS_STYLE: Record<DoseStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  snoozed: "bg-accent text-accent-foreground",
  taken: "bg-success/15 text-success",
  skipped: "bg-destructive/15 text-destructive",
};

function StatusBadge({ status }: { status: DoseStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[status])}>{DOSE_STATUS_LABEL[status]}</span>;
}

function HealthPage() {
  const { date } = useGlobalDate();
  const navigate = useNavigate();
  const medsQ = useMedications();
  const dosesQ = useDoses(date);
  const m = useMedicationMutations();
  const takenQ = useTakenCounts();
  const [tab, setTab] = useState<"hoy" | "meds" | "historial">("hoy");
  const [dialog, setDialog] = useState<{ open: boolean; med: Medication | null }>({ open: false, med: null });
  const [confirm, setConfirm] = useState<Medication | null>(null);
  const [perm, setPerm] = useState<NotifPermission>("default");

  useEffect(() => setPerm(getPermission()), []);

  // Actions arriving from a notification when the app was closed.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("dose");
    const action = p.get("action");
    if (id && (action === "take" || action === "snooze")) {
      m.setStatus.mutate({ id, status: action === "take" ? "taken" : "snoozed" });
      void navigate({ to: "/salud", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meds = medsQ.data ?? [];
  const byId = useMemo(() => new Map(meds.map((x) => [x.id, x])), [meds]);
  const doses = useMemo(
    () => [...(dosesQ.data ?? [])].sort((a, b) => effectiveDueAt(a).getTime() - effectiveDueAt(b).getTime()),
    [dosesQ.data],
  );
  const next = doses.find(isOpen);
  const rest = doses.filter((d) => d.id !== next?.id);
  const done = doses.filter((d) => d.status === "taken").length;

  const setStatus = (id: string, status: DoseStatus) => m.setStatus.mutate({ id, status });

  return (
    <div className="space-y-5 pb-24">
      <GlobalDateHeader />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Salud</h1>
          <p className="text-sm text-muted-foreground">Medicamentos</p>
        </div>
        <Button className="gap-1" onClick={() => setDialog({ open: true, med: null })}>
          <Plus className="h-4 w-4" /> Medicamento
        </Button>
      </div>

      <NotificationBanner perm={perm} onRequest={async () => setPerm(await requestNotificationPermission())} />

      <div role="tablist" className="inline-flex rounded-xl border border-border p-1">
        {([
          ["hoy", "Hoy"],
          ["meds", "Mis medicamentos"],
          ["historial", "Historial"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("rounded-lg px-3 py-1.5 text-sm", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {(medsQ.error || dosesQ.error) && <ErrorState message={((medsQ.error ?? dosesQ.error) as Error).message} />}
      {(medsQ.isLoading || dosesQ.isLoading) && <LoadingState />}

      {tab === "hoy" && !dosesQ.isLoading && (
        <div className="space-y-5">
          {doses.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-6 w-6" />}
              title="Sin tomas para este día"
              description={meds.length ? `No hay medicamentos programados para ${formatDayLabel(date)}.` : "Agrega tu primer medicamento con sus horarios."}
              {...(meds.length ? {} : { actionLabel: "+ Agregar medicamento" })}
              onAction={() => setDialog({ open: true, med: null })}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground" data-help="medication-summary">
                {done} de {doses.length} tomas registradas · {formatDayLabel(date)}
              </p>
              <section className="glass flex items-center gap-3 rounded-2xl p-3 text-sm" aria-label="Agua" data-testid="water-summary">
                <Droplet className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Agua</p>
                  <p className="text-xs text-muted-foreground">+ {formatGlasses(medicationWater(doses))} con medicamentos</p>
                </div>
              </section>
              {next && byId.get(next.medication_id) && (
                <NextDoseCard
                  dose={next}
                  med={byId.get(next.medication_id)!}
                  onAction={setStatus}
                  onWater={(id, glasses) => m.setWater.mutate({ id, glasses })}
                />
              )}
              {rest.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resto del día</h2>
                  <div className="grid gap-2 md:grid-cols-2">
                    {rest.map((d) => {
                      const med = byId.get(d.medication_id);
                      return med ? <DoseRow key={d.id} dose={d} med={med} onAction={setStatus} onWater={(id, glasses) => m.setWater.mutate({ id, glasses })} /> : null;
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === "meds" && !medsQ.isLoading && (
        meds.length === 0 ? (
          <EmptyState icon={<Pill className="h-6 w-6" />} title="Sin medicamentos" actionLabel="+ Agregar medicamento" onAction={() => setDialog({ open: true, med: null })} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {meds.map((med) => (
              <article key={med.id} className={cn("glass rounded-2xl p-4", !med.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{med.name}</h3>
                    <p className="text-sm text-muted-foreground">{doseLabel(med) || "Sin dosis"} · {FREQUENCY_LABEL[med.frequency]}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" aria-label={`Editar ${med.name}`} onClick={() => setDialog({ open: true, med })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Suspender ${med.name}`} onClick={() => setConfirm(med)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {med.times.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"><Clock className="h-3 w-3" />{formatTime12(new Date(`2000-01-01T${t}:00`))}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {med.active ? "Activo" : "Inactivo"} · Aviso {med.remind_offset_min ? `${med.remind_offset_min} min antes` : "a la hora"}
                  {med.end_date ? ` · hasta ${med.end_date}` : ""}
                </p>
                {med.total_quantity != null && (
                  <p className="mt-1 text-xs font-medium" data-testid="med-remaining">
                    {med.total_quantity} {med.unit ?? ""} · {remainingQuantity(med, takenQ.data?.[med.id] ?? 0)} restantes
                  </p>
                )}
                {med.notes && <p className="mt-1 text-xs text-muted-foreground">{med.notes}</p>}
              </article>
            ))}
          </div>
        )
      )}

      {tab === "historial" && <HistoryView byId={byId} anchorDate={date} />}

      <MedicationDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((p) => ({ ...p, open }))}
        medication={dialog.med}
        pending={m.create.isPending || m.update.isPending}
        onSubmit={async (input) => {
          if (dialog.med) await m.update.mutateAsync({ id: dialog.med.id, patch: input });
          else await m.create.mutateAsync(input);
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Suspender ${confirm?.name ?? ""}?`}
        description="El medicamento quedará suspendido y conservará intactas todas sus tomas e historial. No se borrarán registros."
        onConfirm={() => {
          if (confirm) m.remove.mutate(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}

function NotificationBanner({ perm, onRequest }: { perm: NotifPermission; onRequest: () => void }) {
  if (perm === "granted") return null;
  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3 text-sm" data-help="medication-notifications">
      {perm === "denied" || perm === "unsupported" ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <Bell className="h-4 w-4 text-primary" />}
      <p className="min-w-0 flex-1 text-muted-foreground">
        {perm === "unsupported"
          ? "Este navegador no permite notificaciones. Verás los avisos dentro de la app."
          : perm === "denied"
            ? "Las notificaciones están bloqueadas en este navegador. Actívalas desde los permisos del sitio."
            : "Activa las notificaciones para recibir el aviso de cada toma."}
      </p>
      {perm === "default" && <Button size="sm" onClick={onRequest}>Activar avisos</Button>}
    </div>
  );
}

function NextDoseCard({
  dose,
  med,
  onAction,
  onWater,
}: {
  dose: MedicationDose;
  med: Medication;
  onAction: (id: string, s: DoseStatus) => void;
  onWater: (id: string, glasses: number) => void;
}) {
  const due = effectiveDueAt(dose);
  return (
    <section className="glass rounded-3xl border border-primary/30 p-5 md:p-6" aria-label="Próxima toma" data-help="medication-next">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        <Bell className="h-4 w-4" /> Próxima toma
        <span className="ml-auto"><StatusBadge status={dose.status} /></span>
      </div>
      <h2 className="mt-3 text-2xl font-semibold md:text-3xl">{med.name}</h2>
      {doseLabel(med) && <p className="text-lg text-muted-foreground">{doseLabel(med)}</p>}
      <p className="mt-2 text-3xl font-bold tabular-nums md:text-4xl">{formatTime12(due)}</p>
      {dose.status === "snoozed" && <p className="text-xs text-muted-foreground">Programada a las {formatTime12(new Date(dose.scheduled_at))}</p>}
      {dose.status === "taken" && (
        <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Droplet className="h-4 w-4" /> Agua:
          <select
            aria-label={`Agua con ${med.name}`}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={String(Number(dose.water_glasses ?? 0))}
            onChange={(e) => onWater(dose.id, Number(e.target.value))}
          >
            {WATER_OPTIONS.map((w) => (
              <option key={w} value={String(w)}>{formatGlasses(w)}</option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
        <Button className="col-span-3 gap-1 sm:col-span-1" onClick={() => onAction(dose.id, "taken")}><Check className="h-4 w-4" /> Tomada</Button>
        <Button variant="outline" className="gap-1 col-span-3 sm:col-span-1 max-sm:col-span-1 max-sm:col-start-1" onClick={() => onAction(dose.id, "snoozed")}><Clock className="h-4 w-4" /> Posponer</Button>
        <Button variant="ghost" className="gap-1 col-span-3 sm:col-span-1 max-sm:col-span-2" onClick={() => onAction(dose.id, "skipped")}><SkipForward className="h-4 w-4" /> Omitir</Button>
      </div>
    </section>
  );
}

function DoseRow({ dose, med, onAction, onWater }: { dose: MedicationDose; med: Medication; onAction: (id: string, s: DoseStatus) => void; onWater: (id: string, glasses: number) => void }) {
  const open = isOpen(dose);
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Pill className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{med.name}</p>
          <p className="text-xs text-muted-foreground">
            {[doseLabel(med), formatTime12(effectiveDueAt(dose))].filter(Boolean).join(" · ")}
            {dose.taken_at ? ` · tomada ${formatTime12(new Date(dose.taken_at))}` : ""}
          </p>
        </div>
        <StatusBadge status={dose.status} />
        {open ? (
          <Button size="icon" variant="outline" aria-label={`Marcar ${med.name} como tomada`} onClick={() => onAction(dose.id, "taken")}><Check className="h-4 w-4" /></Button>
        ) : (
          <Button size="sm" variant="ghost" aria-label={`Deshacer ${med.name}`} onClick={() => onAction(dose.id, "pending")}>Deshacer</Button>
        )}
      </div>
      {dose.status === "taken" && (
        <label className="mt-2 flex items-center gap-2 pl-[52px] text-xs text-muted-foreground">
          <Droplet className="h-3.5 w-3.5" /> Agua:
          <select
            aria-label={`Agua con ${med.name}`}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            value={String(Number(dose.water_glasses ?? 0))}
            onChange={(e) => onWater(dose.id, Number(e.target.value))}
          >
            {WATER_OPTIONS.map((w) => <option key={w} value={String(w)}>{formatGlasses(w)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function HistoryView({ byId, anchorDate }: { byId: Map<string, Medication>; anchorDate: string }) {
  const to = anchorDate;
  const [days, setDays] = useState(7);
  const from = addDaysISO(to, -(days - 1));
  const q = useDoseHistory(from, to);
  const rows = q.data ?? [];
  const groups = useMemo(() => {
    const g = new Map<string, MedicationDose[]>();
    for (const r of rows) g.set(r.dose_date, [...(g.get(r.dose_date) ?? []), r]);
    return [...g.entries()];
  }, [rows]);
  const count = (s: DoseStatus) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        {[7, 30].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>Últimos {d} días</Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["taken", "pending", "snoozed", "skipped"] as DoseStatus[]).map((s) => (
          <div key={s} className="glass rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">{DOSE_STATUS_LABEL[s]}</p>
            <p className="text-2xl font-semibold tabular-nums">{count(s)}</p>
          </div>
        ))}
      </div>
      {q.isLoading && <LoadingState />}
      {!q.isLoading && rows.length === 0 && <EmptyState title="Sin registros en este período" />}
      {groups.map(([d, list]) => (
        <section key={d} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{formatDayLabel(d)}</h3>
          <div className="glass divide-y divide-border rounded-2xl">
            {list.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{formatTime12(new Date(r.scheduled_at))}</span>
                <span className="min-w-0 flex-1 truncate">{byId.get(r.medication_id)?.name ?? "Medicamento eliminado"}</span>
                {r.taken_at && <span className="hidden text-xs text-muted-foreground sm:inline">tomada {formatTime12(new Date(r.taken_at))}</span>}
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}