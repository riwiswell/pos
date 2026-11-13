import { useEffect, useState } from "react";

import { EmojiPicker } from "@/components/common/EmojiPicker";

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
import type { HabitCategory, HabitCategoryInput } from "@/domain/types";

const PALETTE = [
  "#7dd3fc",
  "#a7f3d0",
  "#fcd34d",
  "#fca5a5",
  "#c4b5fd",
  "#f9a8d4",
  "#94a3b8",
  "#fdba74",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: HabitCategory | null;
  onSubmit: (input: HabitCategoryInput) => void;
}

export function CategoryDialog({ open, onOpenChange, category, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]!);
  const [icon, setIcon] = useState("✨");

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setColor(category?.color ?? PALETTE[0]!);
    setIcon(category?.icon ?? "✨");
  }, [open, category]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color, icon });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mañana"
              autoFocus
              required
            />
          </div>
          <EmojiPicker label="Icono de la categoría" value={icon} onChange={setIcon} />
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
                    color === c ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">{category ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}