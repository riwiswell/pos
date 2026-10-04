import { useCallback, useEffect, useState } from "react";

import { useProfile, useProfileMutations } from "@/hooks/use-profile";

/**
 * PERSONAL OS theme.
 *
 * There is only one personalization system: the profile. The preference is
 * stored in `profiles.accent_color` (the existing free-text personalization
 * column) and mirrored to localStorage so the correct skin paints instantly
 * on reload, before the profile query resolves.
 */
export type ThemeName = "dark" | "light";

const STORAGE_KEY = "personal-os:theme";
const LIGHT_CLASS = "theme-light";

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(LIGHT_CLASS, theme === "light");
}

function readStored(): ThemeName {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

function fromProfile(value: string | null | undefined): ThemeName | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

/** Reads the stored preference and keeps <html> in sync. */
export function useTheme() {
  const { data: profile } = useProfile();
  const { save } = useProfileMutations();
  const [theme, setTheme] = useState<ThemeName>("dark");

  // Local mirror first (no flash), then the profile becomes the source of truth.
  useEffect(() => {
    const stored = readStored();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    const remote = fromProfile(profile?.accent_color);
    if (!remote) return;
    setTheme(remote);
    applyTheme(remote);
    window.localStorage.setItem(STORAGE_KEY, remote);
  }, [profile?.accent_color]);

  const changeTheme = useCallback(
    (next: ThemeName) => {
      setTheme(next);
      applyTheme(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      save.mutate({ accent_color: next });
    },
    [save],
  );

  return { theme, setTheme: changeTheme, saving: save.isPending };
}