import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useProfileMediaUrl } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedicationReminders } from "@/hooks/use-medication-reminders";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "personal-os:sidebar-collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setCollapsed(stored === "1");
  }, []);

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });

  return { collapsed, toggle };
}

function ProfileBlock({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const name =
    profile?.display_name ?? profile?.full_name ?? user?.email?.split("@")[0] ?? "Mi cuenta";
  const initials = name.slice(0, 2).toUpperCase();
  const avatarUrl = useProfileMediaUrl(profile?.avatar_url).data;

  return (
    <Link
      to="/perfil"
      search={(prev: Record<string, unknown>) => prev}
      title="Mi perfil"
      className={cn(
        "flex items-center gap-3 rounded-xl transition-colors hover:bg-sidebar-accent",
        collapsed && "justify-center",
      )}
    >
      <Avatar className="h-9 w-9 border border-sidebar-border">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">Ver perfil</p>
        </div>
      )}
    </Link>
  );
}


function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed, toggle } = useCollapsed();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOut = useSignOut();
  const { data: profile } = useProfile();
  useTheme();
  useMedicationReminders();


  const background = profile?.background_url ?? null;
  const isColor = Boolean(background?.startsWith("#"));
  const bgImageUrl = useProfileMediaUrl(background && !isColor ? background : null).data;

  const backgroundStyle = isColor
    ? { backgroundColor: background! }
    : bgImageUrl
      ? {
          backgroundImage: `linear-gradient(hsl(var(--background) / 0.82), hsl(var(--background) / 0.92)), url(${bgImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }
      : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground" style={backgroundStyle}>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-64",
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
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                search={(prev: Record<string, unknown>) => prev}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                  collapsed && "justify-center px-0",
                  active && "bg-sidebar-accent",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <ProfileBlock collapsed={collapsed} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className={cn(
              "mt-2 w-full gap-2 text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Cerrar sesión</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <span className="text-sm font-semibold tracking-[0.16em]">PERSONAL OS</span>
        <div className="flex items-center gap-1">
          <ProfileBlock collapsed />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={() => void signOut()}
            className="h-9 w-9"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main
        className={cn(
          "mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-10 md:pt-8",
          collapsed ? "md:pl-[88px]" : "md:pl-[272px]",
        )}
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              search={(prev: Record<string, unknown>) => prev}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}