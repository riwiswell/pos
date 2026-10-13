import { useCallback, useEffect, useState } from "react";

import { useProfile, useProfileMutations } from "@/hooks/use-profile";

export type ThemeName = "dark" | "light";
export const DEFAULT_ACCENT = "#14b8a6";
export const ACCENT_OPTIONS = [
  { label: "Turquesa", value: "#14b8a6" },
  { label: "Azul cielo", value: "#38bdf8" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Violeta", value: "#8b5cf6" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Rojo coral", value: "#f43f5e" },
  { label: "Verde", value: "#22c55e" },
  { label: "Amarillo", value: "#eab308" },
] as const;

const MODE_STORAGE_KEY = "personal-os:theme";
const ACCENT_STORAGE_KEY = "personal-os:accent-color";
const LIGHT_CLASS = "theme-light";

function validAccent(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
function fromProfile(value: string | null | undefined): ThemeName | null {
  return value === "light" || value === "dark" ? value : null;
}
function normalizeAccent(value: string | null | undefined): string | null {
  return validAccent(value) ? value : null;
}

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(LIGHT_CLASS, theme === "light");
}

export function applyAccentColor(value: string) {
  if (typeof document === "undefined" || !validAccent(value)) return;
  const root = document.documentElement;
  const channels = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.reduce((total, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const foreground = luminance > 0.44 ? "#17202a" : "#ffffff";
  root.style.setProperty("--primary", value);
  root.style.setProperty("--ring", value);
  root.style.setProperty("--sidebar-primary", value);
  root.style.setProperty("--sidebar-ring", value);
  // Apply the chosen hue to the workspace itself, not only to buttons and focus rings.
  // These mixes stay subtle in both dark and light modes and update with the theme.
  root.style.setProperty("--sidebar", `color-mix(in oklab, var(--background) 86%, ${value} 14%)`);
  root.style.setProperty("--sidebar-accent", `color-mix(in oklab, var(--background) 72%, ${value} 28%)`);
  root.style.setProperty("--sidebar-border", `color-mix(in oklab, var(--sidebar) 76%, ${value} 24%)`);
  root.style.setProperty("--surface", `color-mix(in oklab, var(--surface-base) 91%, ${value} 9%)`);
  root.style.setProperty("--card", `color-mix(in oklab, var(--card-base) 92%, ${value} 8%)`);
  root.style.setProperty("--input", `color-mix(in oklab, var(--background) 82%, ${value} 18%)`);
  root.style.setProperty("--primary-foreground", foreground);
  root.style.setProperty("--sidebar-primary-foreground", foreground);
}

function readStoredMode(): ThemeName {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(MODE_STORAGE_KEY) === "light" ? "light" : "dark";
}
function readStoredAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const value = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return validAccent(value) ? value : DEFAULT_ACCENT;
}

export function useTheme() {
  const { data: profile } = useProfile();
  const { save } = useProfileMutations();
  const [theme, setThemeState] = useState<ThemeName>("dark");
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    const mode = readStoredMode();
    const accent = readStoredAccent();
    setThemeState(mode);
    setAccentColorState(accent);
    applyTheme(mode);
    applyAccentColor(accent);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const preferences = profile.notification_preferences ?? {};
    const remoteMode = fromProfile(preferences.ui_mode as string | undefined) ?? fromProfile(profile.accent_color);
    if (remoteMode) {
      setThemeState(remoteMode);
      applyTheme(remoteMode);
      window.localStorage.setItem(MODE_STORAGE_KEY, remoteMode);
    }
    const remoteAccent = normalizeAccent(profile.accent_color);
    if (remoteAccent) {
      setAccentColorState(remoteAccent);
      applyAccentColor(remoteAccent);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, remoteAccent);
    }
  }, [profile?.accent_color, profile?.notification_preferences]);

  const changeTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
    const legacyValue = fromProfile(profile?.accent_color);
    save.mutate({
      accent_color: legacyValue ? accentColor : profile?.accent_color ?? accentColor,
      notification_preferences: { ...(profile?.notification_preferences ?? {}), ui_mode: next },
    });
  }, [accentColor, profile?.accent_color, profile?.notification_preferences, save]);

  const changeAccentColor = useCallback((next: string) => {
    if (!validAccent(next)) return;
    setAccentColorState(next);
    applyAccentColor(next);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
    const mode = fromProfile(profile?.notification_preferences?.ui_mode as string | undefined)
      ?? fromProfile(profile?.accent_color) ?? theme;
    save.mutate({
      accent_color: next,
      notification_preferences: { ...(profile?.notification_preferences ?? {}), ui_mode: mode },
    });
  }, [profile?.accent_color, profile?.notification_preferences, save, theme]);

  return { theme, setTheme: changeTheme, accentColor, setAccentColor: changeAccentColor, accentOptions: ACCENT_OPTIONS, saving: save.isPending };
}
