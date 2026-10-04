import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { addDaysISO, isValidISODate, todayISO } from "@/lib/date";

/**
 * PERSONAL OS global date.
 *
 * The selected date lives in the URL (?date=YYYY-MM-DD) so it survives route
 * changes, reloads and deep links, and is shared by every domain.
 */
export function useGlobalDate() {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });

  const raw = search?.["date"];
  const date = isValidISODate(raw) ? raw : todayISO();

  const setDate = useCallback(
    (next: string) => {
      const value = isValidISODate(next) ? next : todayISO();
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, date: value }),
        replace: false,
      });
    },
    [navigate],
  );

  const shiftDate = useCallback((days: number) => setDate(addDaysISO(date, days)), [date, setDate]);
  const goToday = useCallback(() => setDate(todayISO()), [setDate]);

  return { date, setDate, shiftDate, goToday };
}