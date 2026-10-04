import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Upload } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/common/States";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useProfileMediaUrl, useProfileMutations } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useHelpEnabled, useSetHelpEnabled } from "@/hooks/use-help";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Personal OS" },
      {
        name: "description",
        content: "Personaliza tu nombre, tu foto y el fondo de Personal OS.",
      },
      { property: "og:title", content: "Perfil — Personal OS" },
      {
        property: "og:description",
        content: "Personaliza tu nombre, tu foto y el fondo de Personal OS.",
      },
    ],
  }),
  component: ProfilePage,
});

/** Discrete but clearly distinguishable backgrounds — no two near-identical tones. */
const BACKGROUND_COLORS = [
  "#0a0a0c", // grafito
  "#242730", // gris oscuro
  "#0f1f3d", // azul noche
  "#3a4759", // azul grisáceo
  "#2f4034", // verde oscuro
  "#5c6f5f", // verde gris
  "#3b2338", // morado oscuro
  "#4a2230", // burdeos
  "#8c6f4e", // arena tostada
  "#c9b48f", // beige cálido
  "#e8dcc4", // crema
  "#d6d3cb", // gris cálido
] as const;

function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useProfile();
  const { save, uploadMedia } = useProfileMutations();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setDisplayName(profile.display_name ?? profile.full_name ?? "");
    setAvatar(profile.avatar_url);
    setBackground(profile.background_url);
  }, [profileQuery.data]);

  const avatarUrl = useProfileMediaUrl(avatar).data;
  const backgroundUrl = useProfileMediaUrl(
    background && !background.startsWith("#") ? background : null,
  ).data;

  const initials = (displayName || user?.email || "?").slice(0, 2).toUpperCase();

  /** Uploads and persists right away: the image must survive a reload without "Guardar". */
  const pick = async (file: File | undefined, kind: "avatar" | "background") => {
    if (!file) return;
    const path = await uploadMedia.mutateAsync({ file, kind });
    if (kind === "avatar") setAvatar(path);
    else setBackground(path);
    await save.mutateAsync(kind === "avatar" ? { avatar_url: path } : { background_url: path });
  };

  if (profileQuery.isLoading) return <LoadingState />;

  return (
    <div className="space-y-5 pb-16">
      <div>
        <h1 className="text-xl font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Tu nombre, tu foto y el fondo de Personal OS.
        </p>
      </div>

      <section className="glass space-y-4 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || "Foto de perfil"} />}
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={uploadMedia.isPending}
              onClick={() => avatarRef.current?.click()}
            >
              {uploadMedia.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Cambiar foto
            </Button>
            {avatar && (
              <Button variant="ghost" size="sm" onClick={() => setAvatar(null)}>
                Quitar
              </Button>
            )}
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void pick(event.target.files?.[0], "avatar")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Nombre para el saludo</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Ricardo"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Así te saludará Personal OS en Inicio.
          </p>
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div>
          <h2 className="text-sm font-semibold">Apariencia</h2>
          <p className="text-xs text-muted-foreground">
            Elige cómo se ve Personal OS. Se guarda al instante.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "dark", label: "Oscuro", hint: "Noche, bajo brillo", bg: "#161a22", fg: "#f2f4f8" },
              { value: "light", label: "Claro", hint: "Papel cálido, día", bg: "#f7f4ee", fg: "#2b2f3a" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={theme === option.value}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                theme === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent",
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-xs font-bold"
                style={{ backgroundColor: option.bg, color: option.fg }}
              >
                Aa
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <HelpSettingsSection />


      <section className="glass space-y-4 rounded-2xl p-4">
        <div>
          <h2 className="text-sm font-semibold">Fondo</h2>
          <p className="text-xs text-muted-foreground">
            Usa el fondo actual, elige un color o sube una imagen.
          </p>
        </div>


        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBackground(null)}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium",
              background === null
                ? "border-primary bg-primary/10"
                : "border-border text-muted-foreground",
            )}
          >
            Fondo actual
          </button>
          {BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Fondo ${color}`}
              onClick={() => setBackground(color)}
              className={cn(
                "h-10 w-10 rounded-xl border-2",
                background === color ? "border-primary" : "border-border",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1"
            disabled={uploadMedia.isPending}
            onClick={() => bgRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Imagen
          </Button>
          <input
            ref={bgRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void pick(event.target.files?.[0], "background")}
          />
        </div>

        {backgroundUrl && (
          <img
            src={backgroundUrl}
            alt="Vista previa del fondo elegido"
            className="h-28 w-full rounded-xl object-cover"
          />
        )}
      </section>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              display_name: displayName.trim() || null,
              full_name: displayName.trim() || profileQuery.data?.full_name || null,
              avatar_url: avatar,
              background_url: background,
            })
          }
        >
          {save.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

function HelpSettingsSection() {
  const enabled = useHelpEnabled();
  const setEnabled = useSetHelpEnabled();
  return (
    <section className="glass space-y-3 rounded-2xl p-4" aria-label="Configuración">
      <div>
        <h2 className="text-sm font-semibold">Configuración</h2>
        <p className="text-xs text-muted-foreground">Ajustes que aplican a todo Personal OS.</p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
        <Label htmlFor="help-enabled" className="flex items-center gap-1.5">
          Ayudas contextuales <span className="text-xs font-normal text-muted-foreground">({enabled ? "Activadas" : "Desactivadas"})</span>
        </Label>
        <Switch id="help-enabled" checked={enabled} disabled={setEnabled.isPending} onCheckedChange={(v) => setEnabled.mutate(v)} />
      </div>
    </section>
  );
}