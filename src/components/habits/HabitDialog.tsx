import { useEffect, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Habit, HabitCategory, HabitInput, HabitKind, HabitType } from "@/domain/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: HabitCategory[];
  defaultCategoryId: string | null;
  habit: Habit | null;
  onSubmit: (input: HabitInput) => void;
  mode?: "habit" | "activity";
}

const NO_CATEGORY = "__none__";
const HABIT_ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "Bienestar y salud", icons: ["💧","🚰","🥤","🫗","🛁","🧼","🪥","🧴","💊","🩺","🩹","❤️","💗","🫀","🧠","🧘","🧘‍♀️","🧘‍♂️","🏃","🚶","🚴","🏊","🧗","🏋️","🤸","🦵","🫁","🌿"] },
  { label: "Rutinas y tiempo", icons: ["🌅","🌄","🌞","☀️","🌤️","🌇","🌆","🌙","🌛","🌜","🌚","⭐","🌟","✨","💫","⏰","⏱️","⌛","📅","🗓️","🛌","😴","🧹","🧺","🧽","🧺","🪴"] },
  { label: "Lectura y aprendizaje", icons: ["📖","📚","📕","📗","📘","📙","📓","📔","📒","📝","✏️","🖊️","🖋️","📎","🔖","🎓","🧑‍🎓","🔬","🧪","🧮","🌎","🗣️","💬","🇬🇧","🇮🇹","🇧🇷"] },
  { label: "Arte y creatividad", icons: ["🎨","🖌️","🖍️","✒️","🖼️","🧵","🪡","🧶","🪢","📷","📸","🎥","🎬","🎭","🎼","🎹","🎸","🎻","🥁","🎤","🎧","🎷","🪇","🪈","🧩","🪄"] },
  { label: "Movimiento y exterior", icons: ["🏃‍♂️","🏃‍♀️","🚶‍♂️","🚶‍♀️","🚴‍♂️","🚴‍♀️","🏃🏻","🚵","🛹","🛼","🛴","🚣","🏄","⛹️","🤾","🏸","🏓","🎾","⚽","🏀","🏐","🥊","🥋","🥾","🏕️","⛰️","🌳","🌻"] },
  { label: "Comida y hogar", icons: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🥑","🥦","🥕","🥗","🍲","🍳","🥚","🍞","🥛","☕","🫖","🍵","🍽️","🥣","🧑‍🍳","🏠","🛋️","🪟","🧺"] },
  { label: "Relaciones y emociones", icons: ["😘","💋","❤️‍🔥","💕","💞","💓","💝","💌","🤗","🫂","👨‍👩‍👧","👫","💑","💍","🌹","🌷","🌸","🦋","😊","😌","🥰","🙏","🤝","🫶","🎉","🎁"] },
  { label: "Trabajo y objetivos", icons: ["💼","💻","🖥️","⌨️","🖱️","📱","📈","📊","💰","💵","💳","🧾","📦","🛠️","🔧","⚙️","🧰","🏆","🥇","🥈","🎯","🚀","🧭","🗂️","📌","🔑","💡","🪙"] },
  { label: "Diversión", icons: ["🎮","🕹️","🎲","🃏","♟️","🧸","🪁","🎈","🎯","🎳","🎰","🎟️","🎡","🎢","🏖️","🏝️","🚗","🏍️","🚂","✈️","🚀","🐶","🐱","🐾","🐢","🦉","🐝","🌈"] },
  { label: "Tecnología y programación", icons: ["💻","🖥️","🖨️","⌨️","🖱️","📱","📲","🔌","🔋","💾","💿","📀","🧮","🧑‍💻","👩‍💻","👨‍💻","🤖","🦾","⚙️","🛠️","🔧","🧰","🔩","🧲","📡","🛰️","🔭","📷","🎛️","🎚️"] },
  { label: "Ciencia e investigación", icons: ["🔬","🧪","🧫","🧬","🩻","🧠","🦠","🧯","⚗️","🌡️","📐","📏","📊","📈","📉","🧮","🔍","🔎","🧾","🗃️","🧷","🧹"] },
  { label: "Dinero y administración", icons: ["💰","💵","💴","💶","💷","💸","🪙","💳","🏦","🏧","🧾","🧮","📑","📋","📁","📂","🗂️","🗃️","📌","🖊️","✍️","🤝","🪪","🔐"] },
  { label: "Viajes y cultura", icons: ["🧳","🎒","🗺️","🧭","🛫","🛬","✈️","🚆","🚄","🚉","🚗","🚙","🚌","🚲","🛵","🚢","⛴️","🚤","🏝️","🏜️","🏞️","🏛️","🗽","🗼","🏰","⛩️","🕌","⛪","🎎","🎏"] },
  { label: "Mascotas y animales", icons: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦉","🦋","🐝","🐢","🦎","🐠","🐟","🐬","🐳","🦜","🐾","🦴","🪶"] },
  { label: "Naturaleza y jardinería", icons: ["🌱","🌿","☘️","🍀","🪴","🌵","🌴","🌳","🌲","🌾","🌷","🌹","🪻","🌺","🌸","🌼","🌻","🪷","🍄","🪺","🪹","🌎","🌍","🌏","🌙","⭐","🔥","💧","🌊","☀️","🌧️","⛈️"] },
  { label: "Cocina y repostería", icons: ["🧑‍🍳","👩‍🍳","👨‍🍳","🥐","🥖","🥨","🧇","🥞","🧈","🧀","🥩","🍗","🥓","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥙","🍜","🍝","🍣","🍱","🍰","🎂","🧁","🍪","🍩","🍫","🍬","🍯","🫙"] },
  { label: "Música y espectáculos", icons: ["🎵","🎶","🎼","🎤","🎧","🎹","🎸","🪕","🎻","🪈","🥁","🪇","🎷","🎺","📯","🪗","🪘","🎙️","🎚️","🎛️","🎭","🎪","🎟️","🎫","🎬","🎞️","📽️","🩰","💃","🕺"] },
  { label: "Deportes y juegos", icons: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥊","🥋","⛳","🏹","🎣","🤿","🛷","⛸️","🎿","🛼","🛹","🏆","🥇","🎮","🕹️","🎲","♟️"] },
];
const HABIT_ICONS = [...new Set(HABIT_ICON_GROUPS.flatMap((group) => group.icons))];

export function HabitDialog({
  open,
  onOpenChange,
  categories,
  defaultCategoryId,
  habit,
  onSubmit,
  mode = "habit",
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitType>("check");
  const [kind, setKind] = useState<HabitKind>("habit");
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [icon, setIcon] = useState("✨");
  const [iconSearch, setIconSearch] = useState("");
  const [more, setMore] = useState(false);

  // Reset only when the dialog opens, never while the user types.
  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? "");
    setType(habit?.type ?? "check");
    setKind(habit?.kind ?? mode);
    setCategoryId(habit?.category_id ?? defaultCategoryId ?? NO_CATEGORY);
    setTarget(habit?.target != null ? String(habit.target) : "");
    setUnit(habit?.unit ?? "");
    setIcon(habit?.icon ?? (mode === "activity" ? "🎯" : "✨"));
    setIconSearch("");
    setMore(Boolean(habit?.target || habit?.unit || habit?.category_id));
  }, [open, habit, defaultCategoryId, mode]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const parsedTarget = Number(target.replace(",", "."));
    onSubmit({
      name: name.trim(),
      icon,
      type,
      kind: mode === "activity" ? "activity" : kind,
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
      target: type === "counter" && Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null,
      unit: type === "counter" && unit.trim() ? unit.trim() : null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden p-4 sm:max-h-[90vh] sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {habit
              ? habit.kind === "activity" ? "Editar actividad" : "Editar hábito"
              : mode === "activity" ? "Nueva actividad" : "Nuevo hábito"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Nombre</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Caminar"
              autoFocus
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2"><Label>Icono</Label><span className="text-2xl" aria-label="Icono seleccionado">{icon}</span></div>
            <Input value={iconSearch} onChange={(event) => setIconSearch(event.target.value)} placeholder="Buscar: salud, lectura, deporte, amor…" aria-label="Buscar iconos por categoría" />
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border/60 p-3">
              {HABIT_ICON_GROUPS.filter(group => !iconSearch.trim() || group.label.toLocaleLowerCase().includes(iconSearch.trim().toLocaleLowerCase()) || group.icons.some(option => option.includes(iconSearch.trim()))).map(group => {
                const options = iconSearch.trim() && !group.label.toLocaleLowerCase().includes(iconSearch.trim().toLocaleLowerCase()) ? group.icons.filter(option => option.includes(iconSearch.trim())) : group.icons;
                return <section key={group.label} className="space-y-2"><p className="text-xs font-semibold text-muted-foreground">{group.label}</p><div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">{options.map(option => <button key={option} type="button" aria-label={`Elegir icono ${option}`} aria-pressed={icon === option} onClick={() => setIcon(option)} className={"grid h-10 w-10 place-items-center rounded-xl border text-xl transition-all hover:scale-105 " + (icon === option ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border/60 bg-muted/40 hover:bg-accent")}>{option}</button>)}</div></section>;
              })}
              {HABIT_ICON_GROUPS.every(group => !group.label.toLocaleLowerCase().includes(iconSearch.trim().toLocaleLowerCase()) && !group.icons.some(option => option.includes(iconSearch.trim()))) && <p className="py-4 text-center text-xs text-muted-foreground">No hay coincidencias. Puedes pegar tu propio emoji abajo.</p>}
            </div>
            <div className="space-y-1"><Label htmlFor="habit-custom-icon">O pega tu propio emoji</Label><Input id="habit-custom-icon" value={icon} onChange={event => setIcon(event.target.value)} placeholder="Ej. 🥾" maxLength={12}/></div>
            <p className="text-[11px] text-muted-foreground">{HABIT_ICONS.length} iconos disponibles, organizados por tema. También puedes pegar uno propio.</p>
          </div>

          {mode === "habit" && (
          <div className="space-y-1.5">
            <Label>¿Qué es?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["habit", "activity"] as HabitKind[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className={
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors " +
                    (kind === option
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent")
                  }
                >
                  {option === "habit" ? "Hábito" : "Actividad"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El hábito mide constancia día a día; la actividad solo se registra cuando ocurre.
            </p>
          </div>
          )}

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as HabitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="check">Check (hecho / no hecho)</SelectItem>
                <SelectItem value="counter">Contador (cantidad o tiempo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!more && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setMore(true)}
            >
              Más opciones
            </button>
          )}

          {more && (
            <div className="space-y-4 rounded-xl border border-border p-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "counter" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="habit-target">Meta</Label>
                    <Input
                      id="habit-target"
                      inputMode="decimal"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="habit-unit">Unidad</Label>
                    <Input
                      id="habit-unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="vasos, minutos..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sticky bottom-0 z-10 border-t border-border/60 bg-background pt-3 pb-[env(safe-area-inset-bottom)]">
            <Button type="submit">{habit ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}