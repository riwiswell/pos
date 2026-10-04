import { useState } from "react";

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
import { cn } from "@/lib/utils";
import type { PlannerCategory, PlannerCategoryInput } from "@/domain/planner";

const PALETTE = [
  "#7dd3fc",
  "#a7f3d0",
  "#fcd34d",
  "#fca5a5",
  "#c4b5fd",
  "#f9a8d4",
  "#94a3b8",
  "#fdba74",
  "#5eead4",
  "#f0abfc",
  "#bef264",
  "#fda4af",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: PlannerCategory | null;
  onSubmit: (input: PlannerCategoryInput) => void | Promise<unknown>;
}

/**
 * Category editor. It mounts its form only while open so an outside refetch can
 * never reset what the user is typing.
 */
export function PlannerCategoryDialog({ open, onOpenChange, category, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        {open && (
          <CategoryForm
            key={category?.id ?? "new"}
            category={category}
            onSubmit={async (input) => {
              await onSubmit(input);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  onSubmit,
}: {
  category: PlannerCategory | null;
  onSubmit: (input: PlannerCategoryInput) => void | Promise<unknown>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? PALETTE[0]!);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        void onSubmit({ name: name.trim(), color });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="planner-category-name">Nombre</Label>
        <Input
          id="planner-category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Trabajo"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition",
                color.toLowerCase() === c.toLowerCase() ? "border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="color"
            aria-label="Color personalizado"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
          />
          <span className="text-xs text-muted-foreground">Color personalizado</span>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">{category ? "Guardar" : "Crear"}</Button>
      </DialogFooter>
    </form>
  );
}