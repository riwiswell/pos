import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR_PALETTE, isHexColor } from "@/lib/finance-colors";
import { ICON_GROUPS, getIcon } from "@/lib/finance-icons";
import { cn } from "@/lib/utils";

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("Todos");
  const Current = getIcon(value);

  const visibleGroups = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    return ICON_GROUPS
      .filter((group) => !term && activeGroup !== "Todos" ? group.label === activeGroup : true)
      .map((group) => ({
        ...group,
        icons: group.icons.filter((name) => {
          if (!term) return true;
          const aliases: Record<string, string> = {
            Necktie: "corbata traje oficina ropa",
            Banknote: "billete efectivo dinero",
            PiggyBank: "alcancia ahorro",
            HeartPulse: "salud medicina",
            ParkingCircle: "parqueadero estacionamiento",
          };
          return name.toLocaleLowerCase("es").includes(term)
            || group.label.toLocaleLowerCase("es").includes(term)
            || (aliases[name] ?? "").includes(term);
        }),
      }))
      .filter((group) => group.icons.length > 0);
  }, [activeGroup, query]);

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) setQuery("");
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-12 w-12 shrink-0 rounded-xl p-0 shadow-sm">
          <Current className="h-6 w-6" style={{ color }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(25rem,94vw)] p-3 sm:p-4" align="start">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Elige un icono</p>
            <p className="text-[11px] text-muted-foreground">Explora por categorías o busca uno específico.</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{ICON_GROUPS.reduce((total, group) => total + group.icons.length, 0)} iconos</span>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar: corbata, casa, comida…"
          className="mb-3 h-10"
        />
        {!query.trim() && (
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {["Todos", ...ICON_GROUPS.map((group) => group.label)].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveGroup(label)}
                aria-pressed={activeGroup === label}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                  activeGroup === label
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <ScrollArea className="h-[19rem] pr-2">
          {visibleGroups.map((group) => (
            <section key={group.label} className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                <span className="text-[10px] tabular-nums text-muted-foreground">{group.icons.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {group.icons.map((name) => {
                  const Icon = getIcon(name);
                  const selected = value === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name === "Necktie" ? "Corbata" : name}
                      aria-label={name === "Necktie" ? "Icono corbata" : "Icono " + name}
                      aria-pressed={selected}
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "group flex h-14 items-center justify-center rounded-2xl border bg-gradient-to-br from-background to-muted/70 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
                        selected && "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-md",
                      )}
                      style={selected ? { color, borderColor: color, backgroundColor: color + "18" } : undefined}
                    >
                      <Icon className="h-7 w-7 transition-transform group-hover:scale-110" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {visibleGroups.length === 0 && <p className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">No encontré iconos con esa búsqueda.</p>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [custom, setCustom] = useState(value);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-12">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "h-6 w-6 rounded-full border border-border/50 transition-transform",
              value === color && "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Color personalizado"
          value={isHexColor(custom) ? custom : "#7dd3fc"}
          onChange={(event) => {
            setCustom(event.target.value);
            onChange(event.target.value);
          }}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
        />
        <Input
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            if (isHexColor(event.target.value)) onChange(event.target.value);
          }}
          placeholder="#34d399"
          className="h-9 max-w-[8rem] font-mono text-xs"
        />
      </div>
    </div>
  );
}