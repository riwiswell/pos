import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Download, GripVertical, Loader2, RefreshCw, RotateCcw, Save, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HelpTip } from "@/components/common/HelpTip";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useProfileMediaUrl, useProfileMutations } from "@/hooks/use-profile";
import { useHelpEnabled, useSetHelpEnabled } from "@/hooks/use-help";
import { subscribeToBackgroundPush } from "@/services/push.service";
import { toast } from "sonner";
import { lifeGraphService } from "@/services/life-graph.service";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_WIDGETS, normalizeDashboardWidgets } from "@/domain/dashboard";

export const Route = createFileRoute("/_authenticated/perfil")({ component: ProfilePage });

const SIDEBAR_ITEMS = NAV_ITEMS.filter((x) => x.key !== "perfil");
const DEFAULT_ORDER = SIDEBAR_ITEMS.map((x) => x.key);
const FEATURE_LABELS = [
  ["spirituality.fasting", "Espiritualidad → Ayuno"],
  ["health.cycle", "Salud → Registro menstrual"],
  ["health.nutrition", "Salud → Nutrición"],
  ["health.appointments", "Salud → Citas médicas"],
  ["learning.books", "Aprendizaje → Libros"],
] as const;
const WIDGETS = DASHBOARD_WIDGETS;
const BACKUP_TABLES = [
  // Parents and lookup rows first, then their dependent records.
  "profiles",
  "habit_categories", "habits", "habit_logs",
  "planner_categories", "planner_items", "daily_focus",
  "finance_accounts", "finance_categories", "finance_settings", "finance_transactions",
  "finance_budgets", "finance_debts", "finance_savings_goals", "finance_investments",
  "finance_external_sources", "finance_external_snapshots",
  "journal_entries",
  "shopping_lists", "shopping_items",
  "alarms", "health_metrics", "medications", "medication_doses",
  "relationships", "menstrual_profiles", "menstrual_records", "medical_appointments", "nutrition_logs",
  "life_goals", "routines", "routine_logs", "checklists", "checklist_items", "bucket_list",
  "learning_items", "learning_notes", "learning_sessions", "language_profiles",
  "relationship_interactions", "work_items", "work_sessions",
  "spiritual_entries", "spiritual_goals",
  "life_events", "gamification_profiles", "gamification_xp_events", "gamification_achievements", "gamification_challenges",
  "notification_jobs", "ai_runs", "life_links",
];

function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useProfile();
  const { save, uploadMedia } = useProfileMutations();
  const help = useHelpEnabled();
  const setHelp = useSetHelpEnabled();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<string[]>([]);
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
    setOrder(Array.isArray(p.module_order) && p.module_order.length ? [...new Set(p.module_order.filter((key) => SIDEBAR_ITEMS.some((item) => item.key === key)) as string[]), ...DEFAULT_ORDER.filter((key) => !p.module_order.includes(key))] : DEFAULT_ORDER);
    setHidden(Array.isArray(p.hidden_modules) ? p.hidden_modules.filter((key) => key !== "perfil") : []);
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
      if (kind === "avatar") setAvatar(path);
      else setBackground(path);
    } catch {
      // The shared mutation reports the specific storage/validation error.
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveAll = async () => {
    const previousRelationshipNotifications = p?.notification_preferences?.relationships !== false;
    await save.mutateAsync({
      display_name: name.trim() || null,
      full_name: name.trim() || null,
      avatar_url: avatar,
      background_url: background,
      module_order: order,
      hidden_modules: hidden,
      hidden_features: features,
      dashboard_widgets: widgets,
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
        "missing-key": ["Falta configurar VITE_VAPID_PUBLIC_KEY en la compilación de Cloudflare.", "error"],
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
      await lifeGraphService.importBackup(payload.data, BACKUP_TABLES);
      await Promise.all([profileQuery.refetch()]);
      toast.success("Importación completada. Los registros se combinaron por ID; no se borraron datos que no estén en el archivo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el respaldo.");
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  };

  if (profileQuery.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-5 pb-24">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Perfil y configuración</h1>
          <HelpTip helpKey="profile" />
        </div>
        <p className="text-sm text-muted-foreground">
          Identidad, apariencia, orden del sistema, funciones, notificaciones, privacidad y respaldo.
        </p>
      </header>

      <section className="glass space-y-4 rounded-2xl p-4">
        <h2 className="font-semibold">Identidad y apariencia</h2>
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
          {backgroundUrl && <span className="self-center text-xs text-muted-foreground">Fondo cargado</span>}
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="flex items-center gap-1 text-sm font-medium">Ayudas contextuales <HelpTip helpKey="settings.help" /></span>
          <Switch checked={help} onCheckedChange={(value) => setHelp.mutate(value)} />
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold">Sidebar: orden y visibilidad</h2>
        <p className="text-xs text-muted-foreground">La personalización se guarda por usuario.</p>
        {order.map((key, index) => {
          const item = SIDEBAR_ITEMS.find((x) => x.key === key);
          if (!item) return null;
          const visible = !hidden.includes(key);
          return (
            <div key={key} className={cn("flex items-center gap-2 rounded-xl border p-2", !visible && "opacity-50")}>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{item.label}</span>
              <Switch checked={visible} onCheckedChange={(value) => setHidden((current) => value ? current.filter((x) => x !== key) : [...current, key])} />
              <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" disabled={index === order.length - 1} onClick={() => move(index, 1)}><ChevronDown className="h-4 w-4" /></Button>
            </div>
          );
        })}
        <Button variant="outline" onClick={() => { setOrder(DEFAULT_ORDER); setHidden([]); }}>
          <RotateCcw className="mr-1 h-4 w-4" /> Restablecer
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold">Funciones opcionales</h2>
        {FEATURE_LABELS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm">{label}</span>
            <Switch checked={features[key] !== true} onCheckedChange={(value) => setFeatures((current) => ({ ...current, [key]: !value }))} />
          </div>
        ))}
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold">Inicio y widgets</h2>
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
        <h2 className="font-semibold">Notificaciones y privacidad</h2>
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
        <h2 className="font-semibold">WíswellArt → Finanzas</h2>
        <p className="text-sm text-muted-foreground">
          La integración recibe exactamente dos métricas por período: ingresos y egresos. Se guardan como snapshot externo y no contaminan el libro mayor personal.
        </p>
        <div className="rounded-xl border p-3 font-mono text-xs break-all">
          POST /api/integrations/wiswellart<br />
          x-pos-integration-secret<br />
          {"{period_start, period_end, income, expense}"}
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold">Exportar / importar / backup</h2>
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
        <Button onClick={() => void saveAll()} disabled={save.isPending}>
          <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}