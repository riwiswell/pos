import { useState } from "react";
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Droplets,
  Gamepad2,
  NotebookPen,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import {
  DEFAULT_HOME_DASHBOARD_LAYOUT,
  HOME_DASHBOARD_WIDGETS,
  mergeDashboardSettings,
  normalizeDashboardWidgets,
  normalizeHomeDashboardLayout,
  type HomeDashboardLayout,
  type HomeDashboardWidgetKey,
} from "@/domain/dashboard";
import { useProfile, useProfileMutations } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WIDGET_ICONS: Record<HomeDashboardWidgetKey, LucideIcon> = {
  weather: CloudSun,
  habits: Target,
  agenda: CalendarDays,
  reading: BookOpen,
  games: Gamepad2,
  hydration: Droplets,
  diary: NotebookPen,
  activity: Activity,
  "shared-challenges": Trophy,
};

export function DashboardPersonalizer() {
  const profileQuery = useProfile();
  const { save } = useProfileMutations();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HomeDashboardLayout>(DEFAULT_HOME_DASHBOARD_LAYOUT);

  const openEditor = () => {
    setDraft(normalizeHomeDashboardLayout(profileQuery.data?.dashboard_widgets));
    setOpen(true);
  };

  const moveWidget = (key: HomeDashboardWidgetKey, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.order.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.order.length) return current;
      const order = [...current.order];
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, order };
    });
  };

  const setWidgetVisible = (key: HomeDashboardWidgetKey, visible: boolean) => {
    setDraft((current) => ({
      ...current,
      visible: visible
        ? [...current.visible, key]
        : current.visible.filter((item) => item !== key),
    }));
  };

  const saveLayout = async () => {
    const currentValue = profileQuery.data?.dashboard_widgets;
    try {
      await save.mutateAsync({
        dashboard_widgets: mergeDashboardSettings(
          currentValue,
          normalizeDashboardWidgets(currentValue),
          draft,
        ),
      });
      setOpen(false);
    } catch {
      // The shared profile mutation already displays the save error.
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs" onClick={openEditor} aria-label="Personalizar Inicio" title="Personalizar Inicio">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Personalizar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88dvh] max-w-xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Personaliza tu Inicio</DialogTitle>
            <DialogDescription>
              Activa las tarjetas que quieras ver y usa las flechas para colocarlas en el orden que prefieras.
              El diseño se ajustará automáticamente al tamaño de tu pantalla.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[58dvh] space-y-2 overflow-y-auto px-5 py-3">
            {draft.order.map((key, index) => {
              const widget = HOME_DASHBOARD_WIDGETS.find((item) => item.key === key);
              if (!widget) return null;
              const Icon = WIDGET_ICONS[key];
              const visible = draft.visible.includes(key);

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${visible ? "border-primary/25 bg-primary/[.045]" : "bg-muted/20 opacity-70"}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{widget.label}</p>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Subir ${widget.label}`}
                      title="Subir"
                      disabled={index === 0}
                      onClick={() => moveWidget(key, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Bajar ${widget.label}`}
                      title="Bajar"
                      disabled={index === draft.order.length - 1}
                      onClick={() => moveWidget(key, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={visible}
                      onCheckedChange={(value) => setWidgetVisible(key, value)}
                      aria-label={`Mostrar ${widget.label}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="mr-auto gap-2"
              onClick={() => setDraft(DEFAULT_HOME_DASHBOARD_LAYOUT)}
            >
              <RotateCcw className="h-4 w-4" />
              Restablecer
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void saveLayout()} disabled={save.isPending || profileQuery.isLoading}>
              {save.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
