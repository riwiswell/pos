import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, shortTime } from "@/domain/planner";
import type {
  PlannerCategory,
  PlannerCategoryInput,
  PlannerItem,
  PlannerItemInput,
  PlannerItemType,
  PlannerPriority,
} from "@/domain/planner";
import { PlannerCategoryDialog } from "./PlannerCategoryDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Item being edited, or null to create a new one. */
  item: PlannerItem | null;
  type: PlannerItemType;
  date: string;
  categories: PlannerCategory[];
  pending: boolean;
  onSubmit: (input: PlannerItemInput) => Promise<unknown>;
  onCreateCategory: (input: PlannerCategoryInput) => Promise<PlannerCategory>;
}

/**
 * Task/Event editor. Only the title and the date are required; everything else
 * is optional so a quick capture takes seconds.
 */
export function PlannerItemDialog(props: Props) {
  const { open, onOpenChange, item, type } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item
              ? item.type === "task"
                ? "Editar tarea"
                : "Editar evento"
              : type === "task"
                ? "Nueva tarea"
                : "Nuevo evento"}
          </DialogTitle>
        </DialogHeader>
        {open && <ItemForm key={item?.id ?? `new-${type}-${props.date}`} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({
  item,
  type,
  date,
  categories,
  pending,
  onSubmit,
  onCreateCategory,
  onOpenChange,
}: Props) {
  const kind: PlannerItemType = item?.type ?? type;
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [scheduledOn, setScheduledOn] = useState(item?.scheduled_on ?? date);
  const [startTime, setStartTime] = useState(shortTime(item?.start_time ?? null));
  const [endTime, setEndTime] = useState(shortTime(item?.end_time ?? null));
  const [dueOn, setDueOn] = useState(item?.due_on ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [priority, setPriority] = useState<PlannerPriority>(item?.priority ?? "normal");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await onSubmit({
      type: kind,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_on: scheduledOn,
      start_time: startTime || null,
      end_time: kind === "event" ? endTime || null : null,
      due_on: kind === "task" ? dueOn || null : null,
      location: kind === "event" ? location.trim() || null : null,
      priority,
      category_id: categoryId,
    });
    onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="planner-title">Título</Label>
        <Input
          id="planner-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={kind === "task" ? "Ej. Terminar propuesta" : "Ej. Clase de las 3"}
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="planner-date">Fecha</Label>
          <Input
            id="planner-date"
            type="date"
            value={scheduledOn}
            onChange={(event) => setScheduledOn(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="planner-start">Hora {kind === "event" ? "de inicio" : "(opcional)"}</Label>
          <Input
            id="planner-start"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>
      </div>

      {kind === "event" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="planner-end">Fin (opcional)</Label>
            <Input
              id="planner-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planner-location">Ubicación (opcional)</Label>
            <Input
              id="planner-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ej. Oficina"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="planner-due">Vencimiento (opcional)</Label>
          <Input
            id="planner-due"
            type="date"
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Prioridad</Label>
        <div className="flex gap-1.5">
          {(["normal", "important", "urgent"] as PlannerPriority[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                priority === value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {PRIORITY_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Categoría (opcional)</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              categoryId === null
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            Sin categoría
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                categoryId === category.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-full text-xs"
            onClick={() => setCategoryOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="planner-description">Descripción (opcional)</Label>
        <RichTextEditor value={description} onChange={setDescription} placeholder="Descripción…" />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={pending || !title.trim()}>
          {item ? "Guardar" : "Crear"}
        </Button>
      </DialogFooter>

      {/* Creating a category never discards what is already typed here. */}
      <PlannerCategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        category={null}
        onSubmit={async (input) => {
          const created = await onCreateCategory(input);
          setCategoryId(created.id);
        }}
      />
    </form>
  );
}