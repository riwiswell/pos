import { useState } from "react";

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
  const Current = getIcon(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-11 w-11 shrink-0 p-0">
          <Current className="h-5 w-5" style={{ color }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,90vw)] p-3" align="start">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar icono"
          className="mb-2 h-9"
        />
        <ScrollArea className="h-64 pr-2">
          {ICON_GROUPS.map((group) => {
            const icons = group.icons.filter(
              (name) =>
                !query.trim() ||
                name.toLowerCase().includes(query.toLowerCase()) ||
                group.label.toLowerCase().includes(query.toLowerCase()),
            );
            if (icons.length === 0) return null;
            return (
              <div key={group.label} className="mb-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {icons.map((name) => {
                    const Icon = getIcon(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        title={name}
                        onClick={() => {
                          onChange(name);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-lg border border-transparent hover:bg-accent",
                          value === name && "border-primary bg-accent",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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