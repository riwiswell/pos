import { useCallback, useEffect, useState } from "react";

import { useProfile, useProfileMutations } from "@/hooks/use-profile";

export type ThemeName = "dark" | "light";

export const LIGHT_WORKSPACE_COLORS = [
  { label: "Blanco", value: "#FFFFFF" },
  { label: "Marfil", value: "#FFF9ED" },
  { label: "Nube", value: "#F4F7FA" },
  { label: "Azul hielo", value: "#EAF3FC" },
  { label: "Celeste", value: "#E8F5FA" },
  { label: "Menta", value: "#EAF6EF" },
  { label: "Salvia", value: "#EFF2E8" },
  { label: "Lavanda", value: "#F1EDFA" },
  { label: "Rosa palo", value: "#FAEEF2" },
  { label: "Durazno", value: "#FCEFE6" },
  { label: "Arena", value: "#F5EBDD" },
  { label: "Perla", value: "#F1F1EE" },
] as const;

export const DARK_WORKSPACE_COLORS = [
  { label: "Carbón", value: "#171A21" },
  { label: "Grafito", value: "#20242C" },
  { label: "Pizarra", value: "#263241" },
  { label: "Azul noche", value: "#101B30" },
  { label: "Azul profundo", value: "#172B4D" },
  { label: "Petróleo", value: "#102C35" },
  { label: "Bosque", value: "#192D25" },
  { label: "Oliva", value: "#303321" },
  { label: "Vino", value: "#351F2A" },
  { label: "Ciruela", value: "#30213B" },
  { label: "Café", value: "#33271F" },
  { label: "Índigo", value: "#24264A" },
] as const;

const DEFAULT_WORKSPACE_COLOR: Record<ThemeName, string> = {
  light: "#FFF9ED",
  dark: "#171A21",
};

const MODE_STORAGE_KEY = "personal-os:theme";
const LEGACY_COLOR_STORAGE_KEY = "personal-os:accent-color";
const WORKSPACE_STORAGE_KEYS: Record<ThemeName, string> = {
  light: "personal-os:workspace-color:light",
  dark: "personal-os:workspace-color:dark",
};
const LIGHT_CLASS = "theme-light";

function validColor(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function fromProfile(value: string | null | undefined): ThemeName | null {
  return value === "light" || value === "dark" ? value : null;
}

function normalizeColor(value: string | null | undefined): string | null {
  return validColor(value) ? value : null;
}

function readStoredMode(): ThemeName {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(MODE_STORAGE_KEY) === "light" ? "light" : "dark";
}

function isPaletteColor(mode: ThemeName, value: string): boolean {
  const options = mode === "light" ? LIGHT_WORKSPACE_COLORS : DARK_WORKSPACE_COLORS;
  return options.some((option) => option.value.toUpperCase() === value.toUpperCase());
}

function readStoredWorkspaceColor(mode: ThemeName, includeLegacy = false): string {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_COLOR[mode];
  const modeValue = window.localStorage.getItem(WORKSPACE_STORAGE_KEYS[mode]);
  if (validColor(modeValue)) return modeValue;

  // Only migrate a legacy color when it already belongs to this mode's palette.
  // Old saturated accent colors should not become light or dark canvas colors.
  const legacyValue = window.localStorage.getItem(LEGACY_COLOR_STORAGE_KEY);
  return includeLegacy && validColor(legacyValue) && isPaletteColor(mode, legacyValue)
    ? legacyValue
    : DEFAULT_WORKSPACE_COLOR[mode];
}

function readProfileWorkspaceColors(preferences: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const value = preferences?.ui_backgrounds;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle(LIGHT_CLASS, theme === "light");
  // The root is rendered with "dark" for the no-JS/default theme. Remove that
  // marker in light mode so Tailwind dark: utilities do not override light tokens.
  root.classList.toggle("dark", theme === "dark");
}

export function applyWorkspaceColor(value: string) {
  if (typeof document === "undefined" || !validColor(value)) return;
  // A workspace color affects the canvas only, never buttons, cards or fields.
  document.documentElement.style.setProperty("--workspace-background", value);
}

export function useTheme() {
  const { data: profile } = useProfile();
  const { save } = useProfileMutations();
  const [theme, setThemeState] = useState<ThemeName>("dark");
  const [workspaceColor, setWorkspaceColorState] = useState(DEFAULT_WORKSPACE_COLOR.dark);

  useEffect(() => {
    const mode = readStoredMode();
    const color = readStoredWorkspaceColor(mode, true);
    setThemeState(mode);
    setWorkspaceColorState(color);
    applyTheme(mode);
    applyWorkspaceColor(color);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const preferences = (profile.notification_preferences ?? {}) as Record<string, unknown>;
    const remoteMode = fromProfile(preferences.ui_mode as string | undefined)
      ?? fromProfile(profile.accent_color);
    const mode = remoteMode ?? theme;
    const savedColors = readProfileWorkspaceColors(preferences);
    const remoteColor = normalizeColor(savedColors?.[mode] as string | undefined);
    const legacyColor = savedColors
      ? null
      : normalizeColor(profile.accent_color);
    const compatibleLegacyColor = legacyColor && isPaletteColor(mode, legacyColor)
      ? legacyColor
      : null;
    const color = remoteColor
      ?? compatibleLegacyColor
      ?? (savedColors ? DEFAULT_WORKSPACE_COLOR[mode] : readStoredWorkspaceColor(mode, true));

    if (remoteMode) {
      setThemeState(remoteMode);
      applyTheme(remoteMode);
      window.localStorage.setItem(MODE_STORAGE_KEY, remoteMode);
    }
    setWorkspaceColorState(color);
    applyWorkspaceColor(color);
    window.localStorage.setItem(WORKSPACE_STORAGE_KEYS[mode], color);
  }, [profile?.accent_color, profile?.notification_preferences, theme]);

  const changeTheme = useCallback((next: ThemeName) => {
    const preferences = (profile?.notification_preferences ?? {}) as Record<string, unknown>;
    const savedColors = readProfileWorkspaceColors(preferences);
    const nextColor = normalizeColor(savedColors?.[next] as string | undefined)
      ?? (savedColors ? DEFAULT_WORKSPACE_COLOR[next] : readStoredWorkspaceColor(next));

    setThemeState(next);
    setWorkspaceColorState(nextColor);
    applyTheme(next);
    applyWorkspaceColor(nextColor);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
    window.localStorage.setItem(WORKSPACE_STORAGE_KEYS[next], nextColor);

    save.mutate({
      accent_color: profile?.accent_color ?? nextColor,
      notification_preferences: {
        ...preferences,
        ui_mode: next,
        ui_backgrounds: { ...(savedColors ?? {}), [next]: nextColor },
      },
    });
  }, [profile?.accent_color, profile?.notification_preferences, save]);

  const changeWorkspaceColor = useCallback((next: string) => {
    if (!validColor(next)) return;
    const preferences = (profile?.notification_preferences ?? {}) as Record<string, unknown>;
    const savedColors = readProfileWorkspaceColors(preferences);

    setWorkspaceColorState(next);
    applyWorkspaceColor(next);
    window.localStorage.setItem(WORKSPACE_STORAGE_KEYS[theme], next);
    window.localStorage.setItem(LEGACY_COLOR_STORAGE_KEY, next);

    save.mutate({
      accent_color: next,
      notification_preferences: {
        ...preferences,
        ui_mode: theme,
        ui_backgrounds: { ...(savedColors ?? {}), [theme]: next },
      },
    });
  }, [profile?.accent_color, profile?.notification_preferences, save, theme]);

  const workspaceColorOptions = theme === "light" ? LIGHT_WORKSPACE_COLORS : DARK_WORKSPACE_COLORS;

  return {
    theme,
    setTheme: changeTheme,
    workspaceColor,
    setWorkspaceColor: changeWorkspaceColor,
    workspaceColorOptions,
    saving: save.isPending,
  };
}
