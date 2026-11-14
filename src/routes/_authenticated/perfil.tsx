import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, RefreshCw, Save, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HelpTip } from "@/components/common/HelpTip";
import { ErrorState } from "@/components/common/States";
import { cn } from "@/lib/utils";
import { SkinBranding } from "@/components/shell/SkinBranding";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useProfileMediaUrl, useProfileMutations } from "@/hooks/use-profile";
import { useHelpEnabled, useSetHelpEnabled } from "@/hooks/use-help";
import { subscribeToBackgroundPush } from "@/services/push.service";
import { toast } from "sonner";
import { lifeGraphService } from "@/services/life-graph.service";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_WIDGETS, mergeDashboardSettings, normalizeDashboardWidgets } from "@/domain/dashboard";

export const Route = createFileRoute("/_authenticated/perfil")({ component: ProfilePage });

const FEATURE_LABELS = [
  ["spirituality.fasting", "Espiritualidad → Ayuno"],
  ["health.cycle", "Salud → Registro menstrual"],
  ["health.nutrition", "Salud → Nutrición"],
  ["health.appointments", "Salud → Citas médicas"],
  ["learning.books", "Aprendizaje → Libros"],
] as const;
const WIDGETS = DASHBOARD_WIDGETS;
const BACKUP_TABLES = [
  // Restore user-defined challenge rows before source records run gamification triggers.
  "profiles", "gamification_challenges",
  // Parents and lookup rows first, then their dependent records.
  "habit_categories", "habits", "habit_logs",
  "planner_categories", "planner_items", "daily_focus",
  "finance_accounts", "finance_categories", "finance_settings", "finance_transactions",
  "finance_budgets", "finance_debts", "finance_savings_goals", "finance_investments",
  "journal_entries",
  "shopping_lists", "shopping_items",
  "alarms", "health_metrics", "medications", "medication_doses",
  "relationships", "menstrual_profiles", "menstrual_records", "medical_appointments", "nutrition_logs",
  "life_goals", "routines", "routine_logs", "checklists", "checklist_items", "bucket_list",
  "learning_items", "learning_notes", "learning_sessions", "language_profiles",
  "relationship_interactions", "work_items", "work_sessions",
  "spiritual_entries", "spiritual_goals",
  "life_events", "gamification_profiles", "gamification_xp_events", "gamification_achievements",
  "notification_jobs", "ai_runs", "life_links",
];

function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useProfile();
  const { save, uploadMedia } = useProfileMutations();
  const help = useHelpEnabled();
  const setHelp = useSetHelpEnabled();
  const { theme, setTheme, skin, setSkin, skins, workspaceColor, setWorkspaceColor, workspaceColorOptions } = useTheme();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [widgets, setWidgets] = useState<string[]>([...DEFAULT_DASHBOARD_WIDGETS]);
  const [relationshipNotifications, setRelationshipNotifications] = useState<boolean>(true);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const avatarInput = useRef<HTMLInputElement | null>(null);
  const backgroundInput = useRef<HTMLInputElement | null>(null);
  const importInput = useRef<HTMLInputElement | null>(null);
  const p = profileQuery.data;

  useEffect(() => {
    if (!p) return;
    setName(p.display_name || p.full_name || "");
    setAvatar(p.avatar_url);
    setBackground(p.background_url);
    setFeatures(p.hidden_features || {});
    setWidgets(normalizeDashboardWidgets(p.dashboard_widgets));
    setRelationshipNotifications(p.notification_preferences?.relationships !== false);
  }, [p]);

  const avatarUrl = useProfileMediaUrl(avatar).data;
  const backgroundUrl = useProfileMediaUrl(background && !background.startsWith("#") ? background : null).data;

  const pick = async (file: File | undefined, kind: "avatar" | "background") => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadMedia.mutateAsync({ file, kind });
      if (kind === "avatar") {
        setAvatar(path);
      } else {
        // Uploading a background also saves its profile reference immediately.
        // Previously the file was uploaded but remained inactive until Save configuration.
        await save.mutateAsync({ background_url: path });
        setBackground(path);
        await profileQuery.refetch();
      }
    } catch {
      // The shared mutation reports the specific storage/validation error.
    } finally {
      setBusy(false);
    }
  };

  const removeBackground = async () => {
    if (!background) return;
    setBusy(true);
    try {
      // Clear the profile reference; the workspace then falls back to its selected color.
      await save.mutateAsync({ background_url: null });
      setBackground(null);
      await profileQuery.refetch();
    } catch {
      // The shared mutation reports the specific persistence error.
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    const previousRelationshipNotifications = p?.notification_preferences?.relationships !== false;
    await save.mutateAsync({
      display_name: name.trim() || null,
      full_name: name.trim() || null,
      avatar_url: avatar,
      background_url: background,
      hidden_features: features,
      dashboard_widgets: mergeDashboardSettings(p?.dashboard_widgets, normalizeDashboardWidgets(widgets)),
      notification_preferences: {
        ...(p?.notification_preferences || {}),
        relationships: relationshipNotifications,
      },
    });

    if (previousRelationshipNotifications !== relationshipNotifications) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Inicia sesión para sincronizar los recordatorios.");
        const response = await fetch("/api/notification-preferences", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ relationships: relationshipNotifications }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string; scheduled?: number };
        if (!response.ok) throw new Error(result.error || "No se pudieron sincronizar los recordatorios.");
        toast.success(relationshipNotifications
          ? "Recordatorios de relaciones activados (" + (result.scheduled ?? 0) + " programados)."
          : "Recordatorios de relaciones desactivados.");
      } catch (error) {
        toast.error(error instanceof Error
          ? "Perfil guardado, pero no se pudieron sincronizar los recordatorios: " + error.message
          : "Perfil guardado, pero no se pudieron sincronizar los recordatorios.");
      }
    }
  };

  const activateBackgroundNotifications = async () => {
    setPushBusy(true);
    try {
      const result = await subscribeToBackgroundPush();
      const messages = {
        subscribed: ["Notificaciones en segundo plano activadas.", "success"],
        unsupported: ["Este navegador no admite notificaciones push.", "error"],
        "permission-denied": ["Permite las notificaciones del navegador para continuar.", "error"],
        "missing-key": ["Falta configurar VAPID_PUBLIC_KEY en las variables de runtime de Cloudflare.", "error"],
        "no-session": ["Tu sesión ha caducado. Inicia sesión y vuelve a intentarlo.", "error"],
        failed: ["No se pudo registrar el dispositivo para notificaciones push.", "error"],
      } as const;
      const [message, kind] = messages[result];
      if (kind === "success") toast.success(message);
      else toast.error(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron activar las notificaciones.");
    } finally {
      setPushBusy(false);
    }
  };

  const exportBackup = async () => {
    try {
      const entries = await Promise.all(
        BACKUP_TABLES.map(async (table) => [table, await lifeGraphService.list(table as any)] as const),
      );
      const payload = {
        format: "personal-os-backup-v1",
        exported_at: new Date().toISOString(),
        user_id: user?.id,
        data: Object.fromEntries(entries),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "personal-os-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Respaldo generado con los datos accesibles de Personal OS.");
    } catch (error) {
      toast.error(error instanceof Error ? "No se pudo generar el respaldo: " + error.message : "No se pudo generar el respaldo.");
    }
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.format !== "personal-os-backup-v1" || !payload?.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
        throw new Error("El archivo no tiene el formato de respaldo de Personal OS.");
      }
      if (!user?.id) throw new Error("Inicia sesión para importar un respaldo.");
      if (payload.user_id && payload.user_id !== user.id) {
        throw new Error("Este respaldo pertenece a otro usuario.");
      }
      const imported = await lifeGraphService.importBackup(payload.data, BACKUP_TABLES);
      await Promise.all([profileQuery.refetch()]);
      if (imported.rebuiltTables.length) {
        toast.success("Datos personales restaurados. Los eventos, XP/logros derivados y recordatorios pendientes se reconstruyen desde los registros importados.");
      } else {
        toast.success("Importación completada. Los registros se combinaron por ID; no se borraron datos que no estén en el archivo.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el respaldo.");
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  };

  if (profileQuery.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  if (profileQuery.isLoading) {
    return <div className="space-y-4 p-4"><p className="text-sm text-muted-foreground">Cargando configuración de Perfil…</p></div>;
  }
  if (profileQuery.isError) {
    return <div className="space-y-4 p-4"><ErrorState message={profileQuery.error instanceof Error ? profileQuery.error.message : "No se pudo cargar la configuración de Perfil."} /><Button variant="outline" onClick={() => void profileQuery.refetch()}>Reintentar</Button></div>;
  }

  return (
    <div className="space-y-5 pb-24 text-foreground">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Perfil y configuración</h1>
          <HelpTip helpKey="profile" />
        </div>
        <p className="text-sm text-foreground/80">
          Identidad, apariencia, preferencias, notificaciones, privacidad y respaldo.
        </p>
      </header>

      <section className="glass space-y-4 rounded-2xl p-4">
        <h2 className="font-semibold text-foreground">Identidad y apariencia</h2>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{(name || "PS").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => avatarInput.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Foto
          </Button>
          <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], "avatar"); e.currentTarget.value = ""; }} />
        </div>
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>Oscuro</Button>
          <Button size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>Claro</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => backgroundInput.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Fondo
          </Button>
          <input ref={backgroundInput} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], "background"); e.currentTarget.value = ""; }} />
          {background && !background.startsWith("#") && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void removeBackground()}>
              <X className="mr-1 h-4 w-4" /> Quitar fondo
            </Button>
          )}
          {backgroundUrl && <span className="self-center text-xs text-muted-foreground">Fondo aplicado</span>}
        </div>
        {backgroundUrl ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <img src={backgroundUrl} alt="Vista previa del fondo personalizado" className="max-h-44 w-full object-cover" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Puedes subir una imagen para usarla como fondo. Se guardará y aplicará automáticamente.</p>
        )}
        <div className="space-y-2">
          <Label>Color del fondo — {theme === "light" ? "Claro" : "Oscuro"}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {workspaceColorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={"Usar fondo " + option.label}
                aria-pressed={workspaceColor.toUpperCase() === option.value.toUpperCase()}
                onClick={() => setWorkspaceColor(option.value)}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  workspaceColor.toUpperCase() === option.value.toUpperCase()
                    ? "scale-110 border-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border hover:scale-105",
                )}
                style={{ backgroundColor: option.value }}
              />
            ))}
            <input
              aria-label="Elegir color personalizado para el fondo"
              title="Elegir otro color"
              type="color"
              value={workspaceColor}
              onChange={(event) => setWorkspaceColor(event.target.value)}
              className="h-9 w-9 cursor-pointer rounded-full border border-border bg-transparent p-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            La paleta cambia según el modo. El color solo se aplica al fondo del espacio de trabajo; tarjetas, formularios y controles conservan sus propios colores.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="flex items-center gap-1 text-sm font-medium">Ayudas contextuales <HelpTip helpKey="settings.help" /></span>
          <Switch checked={help} onCheckedChange={(value) => setHelp.mutate(value)} />
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div>
          <h2 className="font-semibold text-foreground">Biblioteca de skins y emblemas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cambia la identidad visual completa: tipografía, paleta, superficies, controles, bordes y estilo de los paneles. Tus datos y funciones permanecen intactos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {skins.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSkin(option.id)}
              aria-pressed={skin === option.id}
              className={cn(
                "min-w-0 rounded-2xl border p-3 text-left transition-all",
                skin === option.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                  : "border-border hover:border-primary/50",
              )}
            >
              <div className={cn("skin-preview mb-3", `skin-preview--${option.id}`)}>
                <SkinBranding skin={option.id} />
                <div className="skin-preview__modules" aria-hidden="true">
                  <span style={{ backgroundColor: option.preview.primary }} />
                  <span style={{ backgroundColor: option.preview.accent }} />
                  <span style={{ backgroundColor: option.preview.sidebar }} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-lg leading-none">{option.glyph}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{option.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{option.collection} · {option.tagline}</span>
                  </span>
                </span>
                {skin === option.id && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Activo</span>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cada tarjeta muestra su emblema y nombre de marca, diseñados para reconocer su identidad visual. Son interpretaciones gráficas propias; no son logotipos oficiales ni incluyen material licenciado. Cambiar de skin no modifica tus datos, módulos ni funciones.
        </p>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold text-foreground">Funciones opcionales</h2>
        {FEATURE_LABELS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm">{label}</span>
            <Switch checked={features[key] !== true} onCheckedChange={(value) => setFeatures((current) => ({ ...current, [key]: !value }))} />
          </div>
        ))}
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold text-foreground">Inicio y widgets</h2>
        <p className="text-xs text-muted-foreground">Solo aparecen aquí los bloques disponibles en Inicio. Mantén al menos uno visible para conservar una pantalla de entrada útil.</p>
        {WIDGETS.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between rounded-xl border p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{label}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
            <Switch
              checked={widgets.includes(key)}
              onCheckedChange={(value) => setWidgets((current) => {
                const next = value
                  ? (current.includes(key) ? current : [...current, key])
                  : current.filter((x) => x !== key);
                if (next.length === 0) {
                  toast.info("Mantén al menos un bloque visible en Inicio.");
                  return current;
                }
                return next;
              })}
            />
          </div>
        ))}
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold text-foreground">Notificaciones y privacidad</h2>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm">Cumpleaños, aniversarios y seguimientos de relaciones</span>
          <Switch checked={relationshipNotifications} onCheckedChange={setRelationshipNotifications} />
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-sm font-medium">Privacidad de IA</p>
          <p className="mt-1 text-xs text-muted-foreground">La IA Personal actual calcula señales con funciones internas y no envía tus registros a proveedores externos. El control para análisis externo aparecerá cuando exista esa integración.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Este ajuste solo controla los recordatorios de relaciones. Medicamentos, alarmas y citas médicas se programan desde cada registro. Los avisos locales requieren permiso del navegador; los push cuando Personal OS está cerrado requieren credenciales VAPID en Cloudflare.
        </p>
        <Button variant="outline" disabled={pushBusy} onClick={() => void activateBackgroundNotifications()}>
          <RefreshCw className={cn("mr-1 h-4 w-4", pushBusy && "animate-spin")} />
          {pushBusy ? "Activando…" : "Activar notificaciones en segundo plano"}
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold text-foreground">Exportar / importar / backup</h2>
        <p className="text-xs text-muted-foreground">
          El JSON combina registros por ID y no borra datos que falten en el archivo; no es una restauración transaccional. Las fotos y otros archivos de Storage, así como las suscripciones push del navegador, no se copian al JSON. Conserva la misma cuenta de usuario y revisa cada resultado antes de usar la importación como recuperación.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportBackup()}><Download className="mr-1 h-4 w-4" /> Exportar JSON</Button>
          <Button variant="outline" disabled={importing} onClick={() => importInput.current?.click()}>
            {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Importar JSON
          </Button>
          <input ref={importInput} type="file" accept="application/json" hidden onChange={(e) => void importBackup(e.target.files?.[0])} />
        </div>
        <p className="text-xs text-muted-foreground">La importación valida el usuario del respaldo y actualiza por ID sin borrar datos.</p>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => void saveAll()} disabled={save.isPending || profileQuery.isLoading || profileQuery.isError}>
          <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}