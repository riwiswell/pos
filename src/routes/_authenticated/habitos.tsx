import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HabitRow } from "@/components/habits/HabitRow";
import { HabitDialog } from "@/components/habits/HabitDialog";
import { CategoryDialog } from "@/components/habits/CategoryDialog";
import { NoteDialog } from "@/components/habits/NoteDialog";
import { HabitMatrix } from "@/components/habits/HabitMatrix";
import { ActivityView } from "@/components/habits/ActivityView";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useCategories, useHabitMutations, useHabits, useLogs } from "@/hooks/use-habits";
import type { Habit, HabitCategory, HabitLog } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — Personal OS" },
      {
        name: "description",
        content: "Registra y revisa tus hábitos diarios por fecha, con historial real.",
      },
      { property: "og:title", content: "Hábitos — Personal OS" },
      {
        property: "og:description",
        content: "Registra y revisa tus hábitos diarios por fecha, con historial real.",
      },
    ],
  }),
  component: HabitsPage,
});

const UNCATEGORIZED = "__uncategorized__";

function HabitsPage() {
  const { date } = useGlobalDate();
  const categoriesQuery = useCategories();
  const habitsQuery = useHabits();
  const logsQuery = useLogs(date);
  const m = useHabitMutations(date);

  const [habitDialog, setHabitDialog] = useState<{
    open: boolean;
    habit: Habit | null;
    categoryId: string | null;
  }>({ open: false, habit: null, categoryId: null });
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    category: HabitCategory | null;
  }>({ open: false, category: null });
  const [noteFor, setNoteFor] = useState<Habit | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "habit" | "category"; id: string; name: string } | null
  >(null);

  const categories = categoriesQuery.data ?? [];
  const habits = habitsQuery.data ?? [];
  const logs = logsQuery.data ?? [];

  const logByHabit = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logs) map.set(log.habit_id, log);
    return map;
  }, [logs]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, Habit[]>();
    for (const habit of habits) {
      const key = habit.category_id ?? UNCATEGORIZED;
      const list = byCategory.get(key) ?? [];
      list.push(habit);
      byCategory.set(key, list);
    }
    const ordered: { key: string; category: HabitCategory | null; habits: Habit[] }[] =
      categories.map((category) => ({
        key: category.id,
        category,
        habits: byCategory.get(category.id) ?? [],
      }));
    const loose = byCategory.get(UNCATEGORIZED) ?? [];
    if (loose.length > 0) ordered.push({ key: UNCATEGORIZED, category: null, habits: loose });
    return ordered;
  }, [categories, habits]);

  function isDone(habit: Habit, log: HabitLog | undefined) {
    if (habit.type === "check") return log?.completed ?? false;
    const target = habit.target ?? 0;
    const value = log?.value ?? 0;
    return target > 0 ? value >= target : value > 0;
  }

  function moveCategory(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const reordered = [...categories];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item!);
    m.reorderCategories.mutate(reordered.map((c, i) => ({ id: c.id, position: i })));
  }

  function moveHabit(list: Habit[], index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    const reordered = [...list];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item!);
    m.reorderHabits.mutate(reordered.map((h, i) => ({ id: h.id, position: i })));
  }

  const loading = categoriesQuery.isLoading || habitsQuery.isLoading;
  const error = categoriesQuery.error ?? habitsQuery.error ?? logsQuery.error;

  return (
    <div className="space-y-5">
      <GlobalDateHeader />

      <Tabs defaultValue="registro" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="registro">Registro</TabsTrigger>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          <TabsTrigger value="matriz">Matriz</TabsTrigger>
        </TabsList>

        <TabsContent value="registro" className="space-y-5">
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur md:top-0 md:-mx-2 md:px-2">
        <h1 className="text-xl font-semibold">Hábitos</h1>
        <div className="flex flex-1 gap-2 sm:flex-none">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1 sm:flex-none"
            onClick={() => setCategoryDialog({ open: true, category: null })}
          >
            <Plus className="h-4 w-4" /> Categoría
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1 sm:flex-none"
            onClick={() => setHabitDialog({ open: true, habit: null, categoryId: null })}
          >
            <Plus className="h-4 w-4" /> Hábito
          </Button>
        </div>
      </div>


      {error && <ErrorState message={(error as Error).message} />}
      {loading && <LoadingState />}

      {!loading && habits.length === 0 && categories.length === 0 && (
        <EmptyState
          title="Aún no tienes hábitos"
          description="Crea una categoría para organizarlos, o crea un hábito directamente."
          actionLabel="+ Crear hábito"
          onAction={() => setHabitDialog({ open: true, habit: null, categoryId: null })}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:[grid-template-columns:repeat(auto-fill,minmax(24rem,1fr))]">
      {!loading &&
        groups.map((group, groupIndex) => {
          const total = group.habits.length;
          const done = group.habits.filter((h) => isDone(h, logByHabit.get(h.id))).length;
          const color = group.category?.color ?? "#94a3b8";
          return (
            <section key={group.key} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {group.category?.name ?? "Sin categoría"}
                </h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {done}/{total}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Crear hábito en ${group.category?.name ?? "Sin categoría"}`}
                  className="h-8 w-8 rounded-full"
                  onClick={() =>
                    setHabitDialog({
                      open: true,
                      habit: null,
                      categoryId: group.category?.id ?? null,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {group.category && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Opciones de ${group.category.name}`}
                        className="h-8 w-8"
                      >
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
                      <DropdownMenuItem onSelect={() => moveCategory(groupIndex, -1)}>
                        Subir
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => moveCategory(groupIndex, 1)}>
                        Bajar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() =>
                          setConfirm({
                            kind: "category",
                            id: group.category!.id,
                            name: group.category!.name,
                          })
                        }
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {group.habits.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    Sin hábitos en esta categoría todavía.
                  </p>
                ) : (
                  group.habits.map((habit, habitIndex) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      log={logByHabit.get(habit.id)}
                      color={color}
                      onToggle={(completed) =>
                        m.saveLog.mutate({
                          habitId: habit.id,
                          patch: { completed, value: completed ? 1 : 0 },
                        })
                      }
                      onValue={(value) =>
                        m.saveLog.mutate({
                          habitId: habit.id,
                          patch: { value, completed: value > 0 },
                        })
                      }
                      onNote={() => setNoteFor(habit)}
                      onEdit={() => setHabitDialog({ open: true, habit, categoryId: null })}
                      onDelete={() =>
                        setConfirm({ kind: "habit", id: habit.id, name: habit.name })
                      }
                      onMove={(direction) => moveHabit(group.habits, habitIndex, direction)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
        </TabsContent>

        <TabsContent value="actividades">
          <ActivityView />
        </TabsContent>

        <TabsContent value="matriz">
          <HabitMatrix />
        </TabsContent>
      </Tabs>

      <HabitDialog
        open={habitDialog.open}
        onOpenChange={(open) => setHabitDialog((prev) => ({ ...prev, open }))}
        categories={categories}
        defaultCategoryId={habitDialog.categoryId}
        habit={habitDialog.habit}
        onSubmit={(input) => {
          if (habitDialog.habit) {
            m.updateHabit.mutate({ id: habitDialog.habit.id, patch: input });
          } else {
            const siblings = habits.filter((h) => h.category_id === input.category_id);
            m.createHabit.mutate({ input, position: siblings.length });
          }
        }}
      />

      <CategoryDialog
        open={categoryDialog.open}
        onOpenChange={(open) => setCategoryDialog((prev) => ({ ...prev, open }))}
        category={categoryDialog.category}
        onSubmit={(input) => {
          if (categoryDialog.category) {
            m.updateCategory.mutate({ id: categoryDialog.category.id, patch: input });
          } else {
            m.createCategory.mutate({ input, position: categories.length });
          }
        }}
      />

      <NoteDialog
        open={Boolean(noteFor)}
        onOpenChange={(open) => !open && setNoteFor(null)}
        habitName={noteFor?.name ?? ""}
        initialNote={noteFor ? (logByHabit.get(noteFor.id)?.note ?? "") : ""}
        onSave={(note) => {
          if (!noteFor) return;
          m.saveLog.mutate({ habitId: noteFor.id, patch: { note } });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === "category"
            ? `¿Eliminar la categoría "${confirm.name}"?`
            : `¿Eliminar el hábito "${confirm?.name ?? ""}"?`
        }
        description={
          confirm?.kind === "category"
            ? "Los hábitos de esta categoría quedarán sin categoría. Esta acción no se puede deshacer."
            : "Se eliminará también su historial de registros. Esta acción no se puede deshacer."
        }
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "category") m.deleteCategory.mutate(confirm.id);
          else m.deleteHabit.mutate(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}