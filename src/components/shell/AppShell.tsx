import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, GripVertical, LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/common/HelpTip";
import { PersonalAssistant } from "@/components/assistant/PersonalAssistant";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/shell/nav-items";
import { useAuth } from "@/hooks/use-auth";
import { profileKeys, useProfile, useProfileMediaUrl } from "@/hooks/use-profile";
import { profileService } from "@/services/profile.service";
import { useAppointmentReminders } from "@/hooks/use-appointment-reminders";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useMedicationReminders } from "@/hooks/use-medication-reminders";
import { useHydrationReminders } from "@/hooks/use-hydration-reminders";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "personal-os:sidebar-collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCollapsed(stored === "1");
  }, []);

  return {
    collapsed,
    toggle: () =>
      setCollapsed((value) => {
        const next = !value;
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        return next;
      }),
  };
}

function orderedAllItems(order: string[] | undefined) {
  const savedOrder = order ?? [];
  const keys = [...savedOrder, ...NAV_ITEMS.map((item) => item.key)];
  const rank = new Map<string, number>();
  keys.forEach((key, index) => { if (!rank.has(key)) rank.set(key, index); });
  const legacyOrganizationPositions = ["habitos", "planeador", "trabajo"]
    .map((key) => savedOrder.indexOf(key))
    .filter((index) => index >= 0);
  if (legacyOrganizationPositions.length && !savedOrder.includes("organizacion")) {
    rank.set("organizacion", Math.min(...legacyOrganizationPositions));
  }
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
  const { collapsed, toggle } = useCollapsed();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuEditing, setMenuEditing] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragState = useRef<{ key: string; pointerId: number; startY: number; active: boolean; targetKey: string | null; order: string[] } | null>(null);
  const menuSaveSequence = useRef(0);
  const menuSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useTheme();
  useMedicationReminders();
  useHydrationReminders();
  useAppointmentReminders();

  const allItems = useMemo(() => orderedAllItems(profile?.module_order), [profile?.module_order]);
  const orderedItems = allItems;
  const hiddenModules = profile?.hidden_modules ?? [];
  const items = useMemo(() => orderedItems.filter((item) => !hiddenModules.includes(item.key)), [orderedItems, profile?.hidden_modules]);
  const menuItems = menuEditing ? orderedItems : items;

  const persistMenu = (order: string[], hidden: string[]) => {
    if (!user?.id) return;
    const sequence = ++menuSaveSequence.current;
    const key = profileKeys.profile(user.id);
    const previous = queryClient.getQueryData(key);

    // Reflect the new order immediately; persist menu changes in sequence.
    queryClient.setQueryData(key, (current: any) =>
      current ? { ...current, module_order: order, hidden_modules: hidden } : current,
    );
    setMenuSaving(true);

    const save = async () => {
      try {
        const saved = await profileService.upsert(user.id, { module_order: order, hidden_modules: hidden });
        if (sequence === menuSaveSequence.current) queryClient.setQueryData(key, saved);
      } catch (error) {
        if (sequence === menuSaveSequence.current) {
          if (previous !== undefined) queryClient.setQueryData(key, previous);
          toast.error(error instanceof Error ? "No se pudo guardar el menú: " + error.message : "No se pudo guardar el menú.");
        }
      } finally {
        if (sequence === menuSaveSequence.current) setMenuSaving(false);
      }
    };

    const next = menuSaveQueue.current.catch(() => undefined).then(save);
    menuSaveQueue.current = next;
  };

  const toggleMenuItem = (key: string, visible: boolean) => {
    const hidden = visible ? hiddenModules.filter((item) => item !== key) : Array.from(new Set([...hiddenModules, key]));
    void persistMenu(allItems.map((item) => item.key), hidden);
  };

  // The first five visible modules follow the user's saved order on mobile.
  // Reordering in the mobile drawer therefore also chooses the bottom-bar shortcuts.
  const mobilePrimaryItems = items.slice(0, 5);
  const mobileMoreItems = items.slice(5);
  const mobileMoreGroups: { group: string; items: typeof mobileMoreItems }[] = [];
  const mobileUngroupedItems = mobileMoreItems;
  const moreActive = mobileMoreItems.some((item) => pathname.startsWith(item.to));
  const currentNavItem = items.find((item) => pathname.startsWith(item.to));
  const currentHelpKey = currentNavItem?.helpKey ?? "dashboard";
  const activeGroup = currentNavItem?.group ?? null;

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


  const renderMenuItem = (
    item: typeof menuItems[number],
    options: { forceExpanded?: boolean; onNavigate?: () => void; hideHelp?: boolean } = {},
  ) => {
    const visible = !hiddenModules.includes(item.key);
    const expanded = options.forceExpanded ?? !collapsed;
    return (
      <div key={item.key} data-sidebar-item-key={item.key}
        className={cn("flex min-w-0 items-center gap-1 rounded-xl transition-colors", !visible && "opacity-55", draggingKey === item.key && "opacity-45", dragTarget === item.key && "bg-sidebar-accent ring-2 ring-sidebar-primary/60")}>
        {expanded && <button type="button" aria-label={"Arrastrar para reordenar " + item.label} title="Arrastra para cambiar de posición"
          className="flex h-10 w-5 shrink-0 touch-none cursor-grab items-center justify-center rounded text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-primary active:cursor-grabbing"
          onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragState.current = { key: item.key, pointerId: event.pointerId, startY: event.clientY, active: false, targetKey: null, order: orderedItems.map((entry) => entry.key) };
          }}
          onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
            const current = dragState.current;
            if (!current || current.key !== item.key || current.pointerId !== event.pointerId) return;
            if (!current.active && Math.abs(event.clientY - current.startY) < 5) return;
            if (!current.active) { current.active = true; setDraggingKey(current.key); }
            event.preventDefault();
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-item-key]");
            const targetKey = target?.dataset.sidebarItemKey;
            current.targetKey = targetKey && targetKey !== current.key ? targetKey : null;
            setDragTarget(current.targetKey);
          }}
          onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
            const current = dragState.current;
            if (!current || current.key !== item.key || current.pointerId !== event.pointerId) return;
            dragState.current = null; setDraggingKey(null); setDragTarget(null);
            const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-item-key]");
            const targetKey = hit?.dataset.sidebarItemKey ?? current.targetKey;
            if (!current.active || !targetKey) return;
            const nextOrder = [...current.order];
            const from = nextOrder.indexOf(current.key); const to = nextOrder.indexOf(targetKey);
            if (from < 0 || to < 0 || from === to) return;
            nextOrder.splice(from, 1); nextOrder.splice(to, 0, current.key);
            void persistMenu(nextOrder, hiddenModules);
          }}
          onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
            const current = dragState.current;
            if (!current || current.key !== item.key || current.pointerId !== event.pointerId) return;
            dragState.current = null; setDraggingKey(null); setDragTarget(null);
          }}>
          <GripVertical className="h-4 w-4" />
        </button>}
        <Link to={item.to} search={(p: Record<string, unknown>) => p} title={item.label}
          onClick={options.onNavigate}
          className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent", !expanded && "flex-none justify-center px-0", pathname.startsWith(item.to) && "bg-sidebar-accent")}>
          <item.icon className="h-4 w-4 shrink-0" />
          {expanded && <span className="truncate">{item.label}</span>}
        </Link>
        {menuEditing ? <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={menuSaving}
          title={(visible ? "Ocultar " : "Mostrar ") + item.label} aria-label={(visible ? "Ocultar " : "Mostrar ") + item.label}
          onClick={() => toggleMenuItem(item.key, !visible)}>
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button> : (expanded && !options.hideHelp && <HelpTip helpKey={item.helpKey} />)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={style}>
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

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="mb-1 flex justify-end">
            <Button type="button" size="icon" variant={menuEditing ? "secondary" : "ghost"} className="h-8 w-8"
              onClick={() => setMenuEditing((current) => !current)} aria-label="Opciones del menú" title="Opciones del menú" aria-pressed={menuEditing}>
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
          {menuItems.map((item) => renderMenuItem(item))}
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
          "app-shell-main w-full px-4 pb-28 pt-4 md:pb-10 md:pt-8 md:px-8",
          collapsed
            ? "md:ml-[80px] md:w-[calc(100%_-_80px)]"
            : "md:ml-[272px] md:w-[calc(100%_-_272px)]",
        )}
      >
        <div className="mx-auto w-full max-w-none">{children}</div>
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
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle>{menuEditing ? "Ordenar módulos" : "Más módulos"}</SheetTitle>
                <SheetDescription>{menuEditing ? "Arrastra los módulos para cambiar su orden. Los cinco primeros quedarán en la barra inferior." : "Accede al resto de Personal OS sin desplazar una barra interminable."}</SheetDescription>
              </div>
              <Button type="button" size="sm" variant={menuEditing ? "secondary" : "outline"} className="shrink-0"
                disabled={menuSaving}
                onClick={() => setMenuEditing((value) => !value)}
                aria-pressed={menuEditing}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />{menuEditing ? "Listo" : "Ordenar"}
              </Button>
            </div>
          </SheetHeader>
          {menuEditing ? (
            <div className="space-y-1.5 pb-2">
              {menuItems.map((item) => renderMenuItem(item, {
                forceExpanded: true,
                hideHelp: true,
                onNavigate: () => setMoreOpen(false),
              }))}
            </div>
          ) : <div className="space-y-3">
            {mobileMoreGroups.map(({ group, items: groupItems }) => (
              <details key={group} className="overflow-hidden rounded-xl border border-border bg-card/40" open={group === activeGroup}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold marker:hidden">
                  <span>{group}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{groupItems.length}</span>
                </summary>
                <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
                  {groupItems.map((item) => (
                    <Link key={item.key} to={item.to} search={(p: Record<string, unknown>) => p}
                      onClick={() => setMoreOpen(false)}
                      aria-current={pathname.startsWith(item.to) ? "page" : undefined}
                      className={cn("flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-accent", pathname.startsWith(item.to) && "border-primary bg-primary/10 text-primary")}>
                      <item.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            {mobileUngroupedItems.length > 0 && (
              <section className="space-y-2">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cuenta</h3>
                <div className="grid grid-cols-2 gap-2">
                  {mobileUngroupedItems.map((item) => (
                    <Link key={item.key} to={item.to} search={(p: Record<string, unknown>) => p}
                      onClick={() => setMoreOpen(false)}
                      aria-current={pathname.startsWith(item.to) ? "page" : undefined}
                      className={cn("flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-accent", pathname.startsWith(item.to) && "border-primary bg-primary/10 text-primary")}>
                      <item.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>}
        </SheetContent>
      </Sheet>
      <PersonalAssistant />
    </div>
  );
}
