import { useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { NoteDialog } from "@/components/habits/NoteDialog";
import { CategoryDialog } from "@/components/habits/CategoryDialog";
import { HabitDialog } from "@/components/habits/HabitDialog";
import { HabitRow } from "@/components/habits/HabitRow";
import { useCategories, useHabitMutations, useHabits, useLogs } from "@/hooks/use-habits";
import { useGlobalDate } from "@/hooks/use-global-date";
import type { Habit, HabitCategory } from "@/domain/types";

const UNCATEGORIZED = "__uncategorized__";

export function ActivityView() {
  const { date } = useGlobalDate();
  const categoriesQ = useCategories();
  const habitsQ = useHabits(true);
  const logsQ = useLogs(date);
  const m = useHabitMutations(date);

  const activities = (habitsQ.data ?? []).filter((item) => item.kind === "activity");
  const categories = categoriesQ.data ?? [];
  const logs = logsQ.data ?? [];

  const [dialog, setDialog] = useState<{ open: boolean; activity: Habit | null }>({
    open: false,
    activity: null,
  });
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    category: HabitCategory | null;
  }>({ open: false, category: null });
  const [noteFor, setNoteFor] = useState<Habit | null>(null);
  const [pauseFor, setPauseFor] = useState<Habit | null>(null);

  const logByActivity = useMemo(() => {
    const map = new Map<string, (typeof logs)[number]>();
    for (const log of logs) map.set(log.habit_id, log);
    return map;
  }, [logs]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, Habit[]>();
    for (const activity of activities) {
      const key = activity.category_id ?? UNCATEGORIZED;
      byCategory.set(key, [...(byCategory.get(key) ?? []), activity]);
    }
    const ordered = categories.map((category) => ({
      key: category.id,
      category,
      items: byCategory.get(category.id) ?? [],
    }));
    const loose = byCategory.get(UNCATEGORIZED) ?? [];
    if (loose.length) {
      ordered.push({
        key: UNCATEGORIZED,
        category: null as HabitCategory | null,
        items: loose,
      });
    }
    return ordered;
  }, [activities, categories]);

  const loading = habitsQ.isLoading || categoriesQ.isLoading || logsQ.isLoading;
  const error = habitsQ.error ?? categoriesQ.error ?? logsQ.error;

  if (loading) return <LoadingState />;
  if (error) {
    return <ErrorState message={error instanceof Error ? error.message : "No se pudieron cargar las actividades."} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Actividades</h2>
          <p className="text-sm text-muted-foreground">
            Regístralas cuando ocurran; no se evalúan como racha de hábitos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setCategoryDialog({ open: true, category: null })}
          >
            <Plus className="h-4 w-4" /> Categoría
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setDialog({ open: true, activity: null })}
          >
            <Plus className="h-4 w-4" /> Actividad
          </Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          title="Aún no tienes actividades"
          description="Crea una actividad para poder registrarla en la fecha seleccionada."
          actionLabel="+ Crear actividad"
          onAction={() => setDialog({ open: true, activity: null })}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <section key={group.key} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {group.category?.name ?? "Sin categoría"}
                </h3>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {group.items.length}
                </span>
                {group.category && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Más acciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          setCategoryDialog({ open: true, category: group.category })
                        }
                      >
                        Editar categoría
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {group.items.map((activity, index) => {
                  if (!activity.active) {
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{activity.name}</p>
                          <p className="text-xs text-muted-foreground">Pausada · El historial se conserva.</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => m.updateHabit.mutate({ id: activity.id, patch: { active: true } })}
                        >
                          Reactivar
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <HabitRow
                      key={activity.id}
                      habit={activity}
                      log={logByActivity.get(activity.id)}
                      color={group.category?.color ?? "#94a3b8"}
                      onToggle={(completed) =>
                        m.saveLog.mutate({
                          habitId: activity.id,
                          patch: { completed, value: completed ? 1 : 0 },
                        })
                      }
                      onValue={(value) =>
                        m.saveLog.mutate({
                          habitId: activity.id,
                          patch: { value, completed: value > 0 },
                        })
                      }
                      onNote={() => setNoteFor(activity)}
                      onEdit={() => setDialog({ open: true, activity })}
                      onDelete={() => setPauseFor(activity)}
                      deleteLabel="Pausar"
                      onMove={(direction) => {
                        const next = index + direction;
                        if (next < 0 || next >= group.items.length) return;
                        const ordered = [...group.items];
                        const [item] = ordered.splice(index, 1);
                        ordered.splice(next, 0, item!);
                        m.reorderHabits.mutate(
                          ordered.map((item, i) => ({ id: item.id, position: i })),
                        );
                      }}
                    />
                  );
                })}
                {group.items.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    Sin actividades en esta categoría.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <HabitDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        categories={categories}
        defaultCategoryId={dialog.activity?.category_id ?? null}
        habit={dialog.activity}
        mode="activity"
        onSubmit={async (input) => {
          if (dialog.activity) {
            await m.updateHabit.mutateAsync({ id: dialog.activity.id, patch: input });
          } else {
            await m.createHabit.mutateAsync({ input, position: activities.length });
          }
        }}
      />

      <CategoryDialog
        open={categoryDialog.open}
        onOpenChange={(open) => setCategoryDialog((prev) => ({ ...prev, open }))}
        category={categoryDialog.category}
        onSubmit={async (input) => {
          if (categoryDialog.category) {
            await m.updateCategory.mutateAsync({
              id: categoryDialog.category.id,
              patch: input,
            });
          } else {
            await m.createCategory.mutateAsync({ input, position: categories.length });
          }
        }}
      />

      <NoteDialog
        open={Boolean(noteFor)}
        onOpenChange={(open) => !open && setNoteFor(null)}
        habitName={noteFor?.name ?? ""}
        initialNote={noteFor ? logByActivity.get(noteFor.id)?.note ?? "" : ""}
        onSave={async (note) => {
          if (!noteFor) return;
          await m.saveLog.mutateAsync({
            habitId: noteFor.id,
            patch: { note },
          });
          setNoteFor(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pauseFor)}
        onOpenChange={(open) => !open && setPauseFor(null)}
        title={pauseFor ? '¿Pausar actividad "' + pauseFor.name + '"?' : "¿Pausar actividad?"}
        description="La actividad dejará de aparecer como activa, pero su historial diario se conservará."
        onConfirm={async () => {
          if (pauseFor) await m.updateHabit.mutateAsync({ id: pauseFor.id, patch: { active: false } });
          setPauseFor(null);
        }}
      />
    </div>
  );
}
