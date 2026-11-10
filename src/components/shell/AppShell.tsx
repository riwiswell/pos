import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, GripVertical, LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/common/HelpTip";
import { PersonalAssistant } from "@/components/assistant/PersonalAssistant";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { useAuth } from "@/hooks/use-auth";
import { profileKeys, useProfile, useProfileMediaUrl } from "@/hooks/use-profile";
import { profileService } from "@/services/profile.service";
import { useAppointmentReminders } from "@/hooks/use-appointment-reminders";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useMedicationReminders } from "@/hooks/use-medication-reminders";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "personal-os:sidebar-collapsed";
const MOBILE_PRIMARY_KEYS = new Set(["inicio", "habitos", "planeador", "salud", "finanzas"]);
const NAV_ICON_TONES: Record<string, string> = {
  inicio: "text-amber-300 bg-amber-300/10",
  habitos: "text-emerald-300 bg-emerald-300/10",
  planeador: "text-violet-300 bg-violet-300/10",
  salud: "text-rose-300 bg-rose-300/10",
  finanzas: "text-cyan-300 bg-cyan-300/10",
  diario: "text-sky-300 bg-sky-300/10",
  vida: "text-orange-300 bg-orange-300/10",
  aprendizaje: "text-indigo-300 bg-indigo-300/10",
  relaciones: "text-pink-300 bg-pink-300/10",
  trabajo: "text-blue-300 bg-blue-300/10",
  espiritualidad: "text-yellow-200 bg-yellow-200/10",
  gamificacion: "text-fuchsia-300 bg-fuchsia-300/10",
};

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCollapsed(stored === "1");
  }, []);

  return {
    collapsed,
    expand: () => {
      setCollapsed(false);
      localStorage.setItem(STORAGE_KEY, "0");
    },
    toggle: () =>
      setCollapsed((value) => {
        const next = !value;
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        return next;
      }),
  };
}

function orderedAllItems(order: string[] | undefined) {
  const keys = [...(order ?? []), ...NAV_ITEMS.map((item) => item.key)];
  const rank = new Map<string, number>();
  keys.forEach((key, index) => { if (!rank.has(key)) rank.set(key, index); });
  return NAV_ITEMS.filter((item) => item.key !== "perfil")
    .sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));
}

function ProfileBlock({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const name =
    profile?.display_name ??
    profile?.full_name ??
    user?.email?.split("@")[0] ??
    "Mi cuenta";
  const avatarUrl = useProfileMediaUrl(profile?.avatar_url).data;

  return (
    <Link
      to="/perfil"
      search={(p: Record<string, unknown>) => p}
      title="Perfil y configuración"
      className={cn(
        "flex items-center gap-3 rounded-xl hover:bg-sidebar-accent",
        collapsed && "justify-center",
      )}
    >
      <Avatar className="h-9 w-9 border border-sidebar-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">Perfil y configuración</p>
        </div>
      )}
    </Link>
  );
}

function useSignOut() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed, toggle, expand } = useCollapsed();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuEditing, setMenuEditing] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragState = useRef<{ key: string; pointerId: number; startY: number; active: boolean; targetKey: string | null; order: string[] } | null>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const desktopFrameRef = useRef<HTMLDivElement>(null);
  const desktopContentRef = useRef<HTMLDivElement>(null);
  const [desktopScale, setDesktopScale] = useState(1);
  const signOut = useSignOut();

  useEffect(() => {
    const frame = desktopFrameRef.current;
    const content = desktopContentRef.current;
    if (!frame || !content) return;

    const desktop = window.matchMedia("(min-width: 768px)");
    let frameRequest = 0;

    const measure = () => {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = window.requestAnimationFrame(() => {
        if (!desktop.matches) {
          setDesktopScale(1);
          return;
        }

        const availableWidth = frame.clientWidth;
        const availableHeight = frame.clientHeight;
        const contentWidth = content.scrollWidth;
        const contentHeight = content.scrollHeight;
        if (!availableWidth || !availableHeight || !contentWidth || !contentHeight) return;

        const nextScale = Math.min(
          1,
          availableWidth / contentWidth,
          availableHeight / contentHeight,
        );
        setDesktopScale((current) =>
          Math.abs(current - nextScale) < 0.002 ? current : nextScale,
        );
      });
    };

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(frame);
    observer?.observe(content);
    window.addEventListener("resize", measure);
    desktop.addEventListener("change", measure);
    measure();

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      desktop.removeEventListener("change", measure);
      window.cancelAnimationFrame(frameRequest);
    };
  }, [collapsed, menuEditing, pathname]);
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useTheme();
  useMedicationReminders();
  useAppointmentReminders();

  const allItems = useMemo(() => orderedAllItems(profile?.module_order), [profile?.module_order]);
  const orderedItems = allItems;
  const hiddenModules = profile?.hidden_modules ?? [];
  const items = useMemo(() => orderedItems.filter((item) => !hiddenModules.includes(item.key)), [orderedItems, profile?.hidden_modules]);
  const menuItems = menuEditing ? orderedItems : items;

  const persistMenu = async (order: string[], hidden: string[]) => {
    if (!user?.id || menuSaving) return;
    setMenuSaving(true);
    try {
      const saved = await profileService.upsert(user.id, { module_order: order, hidden_modules: hidden });
      queryClient.setQueryData(profileKeys.profile(user.id), saved);
      toast.success("Menú guardado", { duration: 1300 });
    } catch (error) {
      toast.error(error instanceof Error ? "No se pudo guardar el menú: " + error.message : "No se pudo guardar el menú.");
    } finally {
      setMenuSaving(false);
    }
  };

  const toggleMenuItem = (key: string, visible: boolean) => {
    const hidden = visible ? hiddenModules.filter((item) => item !== key) : Array.from(new Set([...hiddenModules, key]));
    void persistMenu(allItems.map((item) => item.key), hidden);
  };

  const beginMenuEdit = () => {
    if (collapsed) expand();
    setMenuEditing((current) => !current);
  };
  const mobilePrimaryItems = items.filter((item) => MOBILE_PRIMARY_KEYS.has(item.key));
  const mobileMoreItems = items.filter((item) => !MOBILE_PRIMARY_KEYS.has(item.key));
  const moreActive = mobileMoreItems.some((item) => pathname.startsWith(item.to));
  const currentHelpKey = items.find((item) => pathname.startsWith(item.to))?.helpKey ?? "dashboard";

  const background = profile?.background_url ?? null;
  const isColor = Boolean(background?.startsWith("#"));
  const bgImageUrl = useProfileMediaUrl(background && !isColor ? background : null).data;
  const style = isColor
    ? { backgroundColor: background! }
    : {
        backgroundImage: bgImageUrl
          ? `linear-gradient(color-mix(in oklab, var(--background) 82%, transparent),color-mix(in oklab, var(--background) 92%, transparent)),url(${bgImageUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      };

  return (
    <div className="min-h-screen bg-background text-foreground md:h-dvh md:min-h-0 md:overflow-hidden" style={style}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar md:flex",
          collapsed ? "w-[80px]" : "w-[272px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <span className="text-sm font-semibold tracking-[0.16em] text-sidebar-foreground">
              PERSONAL OS
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="app-shell-nav flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden p-2">
          <Button type="button" size="sm" variant={menuEditing ? "secondary" : "ghost"} className={cn("mb-1 w-full gap-2", collapsed ? "justify-center px-0" : "justify-start")} onClick={beginMenuEdit} aria-pressed={menuEditing} title="Mostrar u ocultar módulos">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{menuEditing ? "Terminar de editar" : "Mostrar / ocultar módulos"}</span>}
          </Button>
          {menuEditing && !collapsed && <p className="app-shell-nav-description px-2 pb-1 text-xs text-muted-foreground">Para reordenar, arrastra un módulo por el tirador del sidebar. Aquí puedes mostrar u ocultar módulos.</p>}
          {menuItems.map((item) => {
            const visible = !hiddenModules.includes(item.key);
            if (menuEditing) return (
              <div key={item.key} className={cn("flex items-center gap-1 rounded-xl border border-sidebar-border px-1.5 py-1", !visible && "opacity-55")}>
                <item.icon className="h-5 w-5 shrink-0 text-sidebar-foreground" />
                {!collapsed && <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-sidebar-foreground">{item.label}</span>}
                <div className="flex shrink-0 items-center gap-0">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={menuSaving} title={(visible ? "Ocultar " : "Mostrar ")+item.label} aria-label={(visible ? "Ocultar " : "Mostrar ")+item.label} onClick={() => toggleMenuItem(item.key,!visible)}>{visible?<Eye className="h-3.5 w-3.5"/>:<EyeOff className="h-3.5 w-3.5"/>}</Button>
                </div>
              </div>
            );
            return (
              <div
                key={item.key}
                data-sidebar-item-key={item.key}
                className={cn(
                  "flex items-center gap-1 rounded-xl transition-colors",
                  draggingKey === item.key && "opacity-45",
                  dragTarget === item.key && "bg-sidebar-accent ring-2 ring-sidebar-primary/60",
                )}
              >
                {!collapsed && (
                  <button
                    type="button"
                    aria-label={"Arrastrar para reordenar " + item.label}
                    title="Arrastra para cambiar de posición"
                    className="flex h-9 w-4 shrink-0 touch-none cursor-grab items-center justify-center rounded text-sidebar-foreground/50 hover:text-sidebar-primary active:cursor-grabbing"
                    onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
                      if (event.button !== 0) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragState.current = {
                        key: item.key,
                        pointerId: event.pointerId,
                        startY: event.clientY,
                        active: false,
                        targetKey: null,
                        order: orderedItems.map((entry) => entry.key),
                      };
                    }}
                    onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
                      const current = dragState.current;
                      if (!current || current.key !== item.key || current.pointerId !== event.pointerId) return;
                      if (!current.active && Math.abs(event.clientY - current.startY) < 8) return;
                      if (!current.active) {
                        current.active = true;
                        setDraggingKey(current.key);
                      }
                      event.preventDefault();
                      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-item-key]");
                      const targetKey = target?.dataset.sidebarItemKey;
                      current.targetKey = targetKey && targetKey !== current.key ? targetKey : null;
                      setDragTarget(current.targetKey);
                    }}
                    onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
                      const current = dragState.current;
                      if (!current || current.key !== item.key || current.pointerId !== event.pointerId) return;
                      dragState.current = null;
                      setDraggingKey(null);
                      setDragTarget(null);
                      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-item-key]");
                      const hitKey = hit?.dataset.sidebarItemKey;
                      const targetKey = hitKey ?? current.targetKey;
                      if (!current.active || !targetKey) return;
                      const next = [...current.order];
                      const from = next.indexOf(current.key);
                      const to = next.indexOf(targetKey);
                      if (from < 0 || to < 0 || from === to) return;
                      next.splice(from, 1);
                      next.splice(to, 0, current.key);
                      void persistMenu(next, hiddenModules);
                    }}
                    onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
                      const current = dragState.current;
                      if (!current || current.key !== item.key || current.pointerId !== event.pointerId) return;
                      dragState.current = null;
                      setDraggingKey(null);
                      setDragTarget(null);
                    }}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                )}
                <Link to={item.to} search={(p: Record<string, unknown>) => p} title={item.label} className={cn(
                  "app-shell-nav-link flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent",
                  collapsed && "flex-none justify-center px-0",
                  pathname.startsWith(item.to) && "bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-primary/20 shadow-sm",
                )}>
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", NAV_ICON_TONES[item.key] ?? "bg-white/5 text-sidebar-foreground")}><item.icon className="h-4.5 w-4.5" /></span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
                {!collapsed && <HelpTip helpKey={item.helpKey} />}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <ProfileBlock collapsed={collapsed} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className={cn("mt-2 w-full gap-2", collapsed ? "justify-center px-0" : "justify-start")}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Cerrar sesión</span>}
          </Button>
        </div>
      </aside>

      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <span className="text-sm font-semibold tracking-[0.16em]">PERSONAL OS</span>
        <div className="flex items-center gap-1">
          <HelpTip helpKey={currentHelpKey} />
          <ProfileBlock collapsed />
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main
        className={cn(
          "app-shell-main w-full min-w-0 px-4 pb-28 pt-4 md:box-border md:h-dvh md:overflow-hidden md:pb-8 md:pt-8 md:px-8",
          collapsed
            ? "md:ml-[80px] md:w-[calc(100%_-_80px)]"
            : "md:ml-[272px] md:w-[calc(100%_-_272px)]",
        )}
      >
        <div
          ref={desktopFrameRef}
          className="mx-auto w-full max-w-[1600px] md:flex md:h-full md:min-h-0 md:items-start md:justify-center md:overflow-hidden"
        >
          <div
            ref={desktopContentRef}
            className="app-shell-content w-full min-w-0 md:shrink-0"
            style={
              desktopScale < 0.999
                ? { transform: `scale(${desktopScale})`, transformOrigin: "top center" }
                : undefined
            }
          >
            {children}
          </div>
        </div>
      </main>

      {/* Five frequent destinations plus a compact drawer for the remaining modules. */}
      <nav aria-label="Navegación principal móvil" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        {mobilePrimaryItems.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            search={(p: Record<string, unknown>) => p}
            title={item.label}
            aria-current={pathname.startsWith(item.to) ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium",
              pathname.startsWith(item.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        ))}
        {mobileMoreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Abrir más módulos"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>Más</span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle>Más módulos</SheetTitle>
            <SheetDescription>Accede al resto de Personal OS sin desplazar una barra interminable.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2">
            {mobileMoreItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                search={(p: Record<string, unknown>) => p}
                onClick={() => setMoreOpen(false)}
                aria-current={pathname.startsWith(item.to) ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-accent",
                  pathname.startsWith(item.to) && "border-primary bg-primary/10 text-primary",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <PersonalAssistant />
    </div>
  );
}
