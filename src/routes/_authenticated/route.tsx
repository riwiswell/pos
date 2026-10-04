import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/AppShell";
import { isValidISODate, todayISO } from "@/lib/date";

interface GlobalSearch {
  date?: string;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): GlobalSearch => ({
    date: isValidISODate(search["date"]) ? (search["date"] as string) : todayISO(),
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});