import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useTheme();
  useMedicationReminders();
  useAppointmentReminders();

  const allItems = useMemo(() => orderedAllItems(profile?.module_order), [profile?.module_order]);
  const hiddenModules = profile?.hidden_modules ?? [];
  const items = useMemo(() => allItems.filter((item) => !hiddenModules.includes(item.key)), [allItems, profile?.hidden_modules]);
  const menuItems = menuEditing ? allItems : items;

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

  const moveMenuItem = (key: string, delta: number) => {
    const order = allItems.map((item) => item.key);
    const index = order.indexOf(key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    void persistMenu(order, hiddenModules);
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

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
          <Button type="button" size="sm" variant={menuEditing ? "secondary" : "ghost"} className={cn("mb-1 w-full gap-2", collapsed ? "justify-center px-0" : "justify-start")} onClick={beginMenuEdit} aria-pressed={menuEditing} title="Editar orden y visibilidad del menú">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{menuEditing ? "Terminar de editar" : "Editar menú"}</span>}
          </Button>
          {menuEditing && !collapsed && <p className="px-2 pb-1 text-xs text-muted-foreground">Los cambios se guardan al instante. Usa las flechas para mover y el ojo para mostrar u ocultar.</p>}
          {menuItems.map((item, index) => {
            const visible = !hiddenModules.includes(item.key);
            if (menuEditing) return (
              <div key={item.key} className={cn("flex items-center gap-1 rounded-xl border border-sidebar-border px-1.5 py-1", !visible && "opacity-55")}>
                <item.icon className="h-5 w-5 shrink-0 text-sidebar-foreground" />
                {!collapsed && <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-sidebar-foreground">{item.label}</span>}
                <div className="flex shrink-0 items-center gap-0">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={menuSaving || index===0} title={"Subir "+item.label} aria-label={"Subir "+item.label} onClick={() => moveMenuItem(item.key,-1)}><ArrowUp className="h-3.5 w-3.5"/></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={menuSaving || index===menuItems.length-1} title={"Bajar "+item.label} aria-label={"Bajar "+item.label} onClick={() => moveMenuItem(item.key,1)}><ArrowDown className="h-3.5 w-3.5"/></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={menuSaving} title={(visible ? "Ocultar " : "Mostrar ")+item.label} aria-label={(visible ? "Ocultar " : "Mostrar ")+item.label} onClick={() => toggleMenuItem(item.key,!visible)}>{visible?<Eye className="h-3.5 w-3.5"/>:<EyeOff className="h-3.5 w-3.5"/>}</Button>
                </div>
              </div>
            );
            return (
              <div key={item.key} className="flex items-center gap-1">
                <Link to={item.to} search={(p: Record<string, unknown>) => p} title={item.label} className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-sidebar-foreground hover:bg-sidebar-accent",
                  collapsed && "flex-none justify-center px-0",
                  pathname.startsWith(item.to) && "bg-sidebar-accent",
                )}>
                  <item.icon className="h-5 w-5 shrink-0" />
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
          "w-full px-4 pb-28 pt-4 md:pb-10 md:pt-8 md:px-8",
          collapsed
            ? "md:ml-[80px] md:w-[calc(100%_-_80px)]"
            : "md:ml-[272px] md:w-[calc(100%_-_272px)]",
        )}
      >
        <div className="mx-auto w-full max-w-6xl">{children}</div>
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
