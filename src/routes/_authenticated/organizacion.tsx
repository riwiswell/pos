import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { BriefcaseBusiness, CalendarDays, Repeat } from "lucide-react";
import { HabitsPage } from "./habitos";
import { PlannerPage } from "./planeador";
import { WorkPage } from "./trabajo";

export const Route = createFileRoute("/_authenticated/organizacion")({
  component: OrganizationPage,
});

const SECTIONS = [
  { key: "habitos", label: "Hábitos", icon: Repeat },
  { key: "planeador", label: "Planeador", icon: CalendarDays },
  { key: "trabajo", label: "Trabajo", icon: BriefcaseBusiness },
] as const;

function OrganizationPage() {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const requested = String(search.tab ?? "habitos");
  const activeTab = SECTIONS.some((section) => section.key === requested)
    ? requested
    : "habitos";

  const selectTab = (tab: string) => {
    void navigate({
      to: "/organizacion",
      search: (previous: Record<string, unknown>) => ({ ...previous, tab }),
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <div className="space-y-4 pb-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Organización</h1>
        <p className="text-sm text-muted-foreground">Hábitos, agenda y trabajo en un mismo lugar.</p>
      </header>
      <nav aria-label="Secciones de Organización" className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-muted/30 p-1">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-current={activeTab === key ? "page" : undefined}
            aria-pressed={activeTab === key}
            onClick={() => selectTab(key)}
            className={"flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition " + (
              activeTab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>
      {activeTab === "habitos" ? <HabitsPage /> : activeTab === "planeador" ? <PlannerPage /> : <WorkPage />}
    </div>
  );
}
