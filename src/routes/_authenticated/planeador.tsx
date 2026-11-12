import { useEffect, useMemo, useState } from "react";
import { HelpTip } from "@/components/common/HelpTip";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, MapPin, Pencil, Plus, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { Calendar } from "@/components/ui/calendar";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PlannerItemDialog } from "@/components/planner/PlannerItemDialog";
import { PlannerCategoryDialog } from "@/components/planner/PlannerCategoryDialog";
import { useGlobalDate } from "@/hooks/use-global-date";
import { usePlannerCategories, usePlannerItems, usePlannerItemsRange, usePlannerMutations } from "@/hooks/use-planner";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "@/lib/date";
import {
  PRIORITY_LABEL,
  TYPE_LABEL,
  compareChronologically,
  shortTime,
} from "@/domain/planner";
import type { PlannerCategory, PlannerItem, PlannerItemType } from "@/domain/planner";

export const Route = createFileRoute("/_authenticated/planeador")({
  head: () => ({
    meta: [
      { title: "Planeador — Personal OS" },
      {
        name: "description",
        content: "Tareas y eventos del día, en orden cronológico real y con categorías propias.",
      },
      { property: "og:title", content: "Planeador — Personal OS" },
      {
        property: "og:description",
        content: "Tareas y eventos del día, en orden cronológico real y con categorías propias.",
      },
    ],
  }),
  component: PlannerPage,
});

function PlannerPage() {
  const { date, setDate, goToday } = useGlobalDate();
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(date + "T12:00:00"));
  const monthYear = calendarMonth.getFullYear();
  const monthIndex = calendarMonth.getMonth();
  const monthStart = `${monthYear}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const monthEnd = `${monthYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(new Date(monthYear, monthIndex + 1, 0).getDate()).padStart(2, "0")}`;
  const categoriesQuery = usePlannerCategories();
  const itemsQuery = usePlannerItems(date);
  const monthItemsQuery = usePlannerItemsRange(monthStart, monthEnd);
  const m = usePlannerMutations(date);

  useEffect(() => {
    setCalendarMonth(new Date(date + "T12:00:00"));
  }, [date]);

  const [itemDialog, setItemDialog] = useState<{
    open: boolean;
    item: PlannerItem | null;
    type: PlannerItemType;
  }>({ open: false, item: null, type: "task" });
  const [detail, setDetail] = useState<PlannerItem | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    category: PlannerCategory | null;
  }>({ open: false, category: null });
  const [confirm, setConfirm] = useState<
    { kind: "item" | "category"; id: string; title: string } | null
  >(null);

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const monthItems = monthItemsQuery.data ?? [];
  const markedDates = useMemo(
    () => [...new Set(monthItems.map((item) => item.scheduled_on))].map((day) => new Date(day + "T12:00:00")),
    [monthItems],
  );
  const monthTaskCount = monthItems.filter((item) => item.type === "task").length;
  const monthEventCount = monthItems.filter((item) => item.type === "event").length;

  const { timed, untimed } = useMemo(() => {
    const sorted = [...items].sort(compareChronologically);
    return {
      timed: sorted.filter((i) => Boolean(i.start_time)),
      untimed: sorted.filter((i) => !i.start_time),
    };
  }, [items]);

  const categoryById = useMemo(() => {
    const map = new Map<string, PlannerCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const loading = itemsQuery.isLoading || categoriesQuery.isLoading;
  const error = itemsQuery.error ?? categoriesQuery.error;

  // Keep the detail sheet in sync with refetched data.
  const currentDetail = detail ? (items.find((i) => i.id === detail.id) ?? detail) : null;

  return (
    <div className="space-y-5 pb-24">
      <GlobalDateHeader />
      <WeatherCard />

      <div className="sticky top-14 z-20 -mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur md:top-0 md:-mx-2 md:px-2">
        <h1 className="truncate text-xl font-semibold">Planeador</h1>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setManageOpen(true)}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Categorías</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setItemDialog({ open: true, item: null, type: "event" })}
          >
            <Plus className="h-4 w-4" /> Evento
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setItemDialog({ open: true, item: null, type: "task" })}
          >
            <Plus className="h-4 w-4" /> Tarea
          </Button>
        </div>
      </div>

      <section className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2 px-2">
            <div><h2 className="text-sm font-semibold">Calendario</h2><p className="text-xs text-muted-foreground">Selecciona un día para ver o programar tus tareas y eventos.</p></div>
            <Button type="button" size="sm" variant="outline" onClick={goToday}>Hoy</Button>
          </div>
          <Calendar
            mode="single"
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={new Date(date + "T12:00:00")}
            modifiers={{ hasItems: markedDates }}
            modifiersClassNames={{ hasItems: "after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary" }}
            onSelect={(day) => {
              if (!day) return;
              const year = day.getFullYear();
              const month = String(day.getMonth() + 1).padStart(2, "0");
              const dayNumber = String(day.getDate()).padStart(2, "0");
              setDate(year + "-" + month + "-" + dayNumber);
            }}
            className="mx-auto sm:mx-0"
          />
        </div>
        <div className="min-w-0 flex-1 self-center rounded-xl bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Día seleccionado</p>
          <p className="mt-1 text-base font-semibold capitalize">{formatDayLabel(date)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length ? `${items.length} elementos · ${items.filter((item) => item.type === "task").length} tareas · ${items.filter((item) => item.type === "event").length} citas o eventos` : "Este día está libre por ahora."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setItemDialog({ open: true, item: null, type: "task" })}><Plus className="mr-1 h-3.5 w-3.5"/>Añadir tarea</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setItemDialog({ open: true, item: null, type: "event" })}><Plus className="mr-1 h-3.5 w-3.5"/>Añadir cita o evento</Button>
          </div>
          <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            {monthItemsQuery.isLoading ? "Actualizando el mes…" : `${monthTaskCount} tareas y ${monthEventCount} citas o eventos en este mes. Puedes registrar tantos como necesites por día.`}
          </p>
        </div>
      </section>

      {error && <ErrorState message={(error as Error).message} />}
      {loading && <LoadingState />}

      {!loading && items.length === 0 && (
        <EmptyState
          title="Nada agendado"
          description={`No tienes tareas ni eventos para ${formatDayLabel(date)}.`}
          actionLabel="+ Crear tarea"
          onAction={() => setItemDialog({ open: true, item: null, type: "task" })}
        />
      )}

      {!loading && timed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Agenda
          </h2>
          <div className="space-y-2">
            {timed.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                category={item.category_id ? categoryById.get(item.category_id) : undefined}
                onOpen={() => setDetail(item)}
                onToggle={() => m.setStatus.mutate({ id: item.id, done: item.status !== "done" })}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && untimed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sin hora
          </h2>
          <div className="space-y-2">
            {untimed.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                category={item.category_id ? categoryById.get(item.category_id) : undefined}
                onOpen={() => setDetail(item)}
                onToggle={() => m.setStatus.mutate({ id: item.id, done: item.status !== "done" })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Always-reachable quick capture. */}
      <Button
        size="icon"
        aria-label="Crear tarea"
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:hidden"
        onClick={() => setItemDialog({ open: true, item: null, type: "task" })}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <PlannerItemDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((prev) => ({ ...prev, open }))}
        item={itemDialog.item}
        type={itemDialog.type}
        date={date}
        categories={categories}
        pending={m.createItem.isPending || m.updateItem.isPending}
        onSubmit={async (input) => {
          if (itemDialog.item) {
            await m.updateItem.mutateAsync({ id: itemDialog.item.id, patch: input });
          } else {
            await m.createItem.mutateAsync(input);
          }
        }}
        onCreateCategory={(input) => m.createCategory.mutateAsync(input)}
      />

      {/* Detail sheet */}
      <Dialog open={Boolean(currentDetail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {currentDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6 text-left">{currentDetail.title}</DialogTitle>
              </DialogHeader>
              <dl className="space-y-2 text-sm">
                <Field label="Tipo" value={TYPE_LABEL[currentDetail.type]} />
                <Field label="Fecha" value={formatDayLabel(currentDetail.scheduled_on)} />
                {currentDetail.start_time && (
                  <Field label="Hora de inicio" value={shortTime(currentDetail.start_time)} />
                )}
                {currentDetail.end_time && (
                  <Field label="Hora de fin" value={shortTime(currentDetail.end_time)} />
                )}
                {currentDetail.due_on && (
                  <Field label="Vencimiento" value={formatDayLabel(currentDetail.due_on)} />
                )}
                {currentDetail.location && (
                  <Field label="Ubicación" value={currentDetail.location} />
                )}
                <Field label="Prioridad" value={PRIORITY_LABEL[currentDetail.priority]} />
                <Field
                  label="Categoría"
                  value={
                    (currentDetail.category_id
                      ? categoryById.get(currentDetail.category_id)?.name
                      : null) ?? "Sin categoría"
                  }
                />
                <Field
                  label="Estado"
                  value={currentDetail.status === "done" ? "Completado" : "Pendiente"}
                />
                {currentDetail.description && (
                  <Field label="Descripción" value={currentDetail.description} />
                )}
              </dl>
              <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-start">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    m.setStatus.mutate({
                      id: currentDetail.id,
                      done: currentDetail.status !== "done",
                    })
                  }
                >
                  <Check className="h-4 w-4" />
                  {currentDetail.status === "done" ? "Marcar pendiente" : "Completar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    setItemDialog({ open: true, item: currentDetail, type: currentDetail.type });
                    setDetail(null);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                  onClick={() =>
                    setConfirm({ kind: "item", id: currentDetail.id, title: currentDetail.title })
                  }
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Category manager */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Categorías del planeador</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no tienes categorías.</p>
            )}
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${category.name}`}
                  className="h-8 w-8"
                  onClick={() => setCategoryDialog({ open: true, category })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar ${category.name}`}
                  className="h-8 w-8 text-destructive"
                  onClick={() =>
                    setConfirm({ kind: "category", id: category.id, title: category.name })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              className="gap-1"
              onClick={() => setCategoryDialog({ open: true, category: null })}
            >
              <Plus className="h-4 w-4" /> Nueva categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlannerCategoryDialog
        open={categoryDialog.open}
        onOpenChange={(open) => setCategoryDialog((prev) => ({ ...prev, open }))}
        category={categoryDialog.category}
        onSubmit={async (input) => {
          if (categoryDialog.category) {
            await m.updateCategory.mutateAsync({ id: categoryDialog.category.id, patch: input });
          } else {
            await m.createCategory.mutateAsync(input);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.kind === "category" ? "Eliminar categoría" : "Eliminar elemento"}
        description={`"${confirm?.title ?? ""}" se eliminará definitivamente. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "category") m.deleteCategory.mutate(confirm.id);
          else {
            m.deleteItem.mutate(confirm.id);
            setDetail(null);
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

function ItemRow({
  item,
  category,
  onOpen,
  onToggle,
}: {
  item: PlannerItem;
  category: PlannerCategory | undefined;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const done = item.status === "done";
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-3 py-3">
      <button
        type="button"
        aria-label={done ? "Marcar pendiente" : "Completar"}
        onClick={onToggle}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors",
          done ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground",
        )}
      >
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
          {item.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {item.start_time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {shortTime(item.start_time)}
              {item.end_time ? `–${shortTime(item.end_time)}` : ""}
            </span>
          )}
          <span>{TYPE_LABEL[item.type]}</span>
          {item.priority !== "normal" && <span>{PRIORITY_LABEL[item.priority]}</span>}
          {item.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.location}
            </span>
          )}
          {category && (
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}