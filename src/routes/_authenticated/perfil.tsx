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
import { requestNotificationPermission } from "@/hooks/use-medication-reminders";
import { lifeGraphService } from "@/services/life-graph.service";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/_authenticated/perfil")({ component: ProfilePage });

const DEFAULT_ORDER = NAV_ITEMS.map((x) => x.key);
const FEATURE_LABELS = [
  ["spirituality.fasting", "Espiritualidad → Ayuno"],
  ["health.cycle", "Salud → Registro menstrual"],
  ["health.nutrition", "Salud → Nutrición"],
  ["health.appointments", "Salud → Citas médicas"],
  ["learning.books", "Aprendizaje → Libros"],
] as const;
const WIDGETS = [
  ["daily", "Resumen del día"],
  ["goals", "Metas"],
  ["ai", "Señales de IA"],
  ["finance", "Finanzas"],
  ["health", "Salud"],
  ["learning", "Aprendizaje"],
] as const;
const BACKUP_TABLES = [
  "profiles","habits","habit_logs","habit_categories","planner_items","planner_categories",
  "finance_accounts","finance_categories","finance_transactions","finance_settings","journal_entries","alarms",
  "health_metrics","medications","medication_doses","shopping_lists","shopping_items","life_goals","routines",
  "routine_logs","checklists","checklist_items","bucket_list","menstrual_profiles","menstrual_records",
  "medical_appointments","nutrition_logs","learning_items","learning_notes","learning_sessions","language_profiles",
  "relationships","relationship_interactions","work_items","work_sessions","spiritual_entries",
  "gamification_achievements","gamification_challenges","life_events","notification_jobs","ai_runs",
  "finance_budgets","finance_debts","finance_savings_goals","finance_investments","finance_external_sources",
  "finance_external_snapshots","life_links",
];

function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useProfile();
  const { save, uploadMedia } = useProfileMutations();
  const help = useHelpEnabled();
  const setHelp = useSetHelpEnabled();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [background, setBackground] = useState(null);
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [hidden, setHidden] = useState([]);
  const [features, setFeatures] = useState({});
  const [widgets, setWidgets] = useState(["daily", "goals", "ai", "finance"]);
  const [privacy, setPrivacy] = useState(true);
  const [relationshipNotifications, setRelationshipNotifications] = useState(true);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const avatarInput = useRef(null);
  const backgroundInput = useRef(null);
  const importInput = useRef(null);
  const p = profileQuery.data;

  useEffect(() => {
    if (!p) return;
    setName(p.display_name || p.full_name || "");
    setAvatar(p.avatar_url);
    setBackground(p.background_url);
    setOrder(Array.isArray(p.module_order) && p.module_order.length ? p.module_order : DEFAULT_ORDER);
    setHidden(Array.isArray(p.hidden_modules) ? p.hidden_modules : []);
    setFeatures(p.hidden_features || {});
    setWidgets(Array.isArray(p.dashboard_widgets) && p.dashboard_widgets.length ? p.dashboard_widgets : ["daily","goals","ai","finance"]);
    setPrivacy(p.notification_preferences?.privacy?.allow_external_ai !== false);
    setRelationshipNotifications(p.notification_preferences?.relationships !== false);
  }, [p]);

  const avatarUrl = useProfileMediaUrl(avatar).data;
  const backgroundUrl = useProfileMediaUrl(background && !background.startsWith("#") ? background : null).data;

  const pick = async (file, kind) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadMedia.mutateAsync({ file, kind });
      if (kind === "avatar") setAvatar(path);
      else setBackground(path);
    } finally {
      setBusy(false);
    }
  };

  const move = (index, delta) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveAll = async () => {
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
        privacy: { allow_external_ai: privacy },
        relationships: relationshipNotifications,
      },
    });
  };

  const exportBackup = async () => {
    const entries = await Promise.all(
      BACKUP_TABLES.map(async (table) => [table, await lifeGraphService.list(table)]),
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
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const payload = JSON.parse(await file.text());
      if (payload.user_id && payload.user_id !== user?.id) {
        throw new Error("Este respaldo pertenece a otro usuario.");
      }
      await lifeGraphService.importBackup(payload.data || {}, BACKUP_TABLES);
      await profileQuery.refetch();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo importar el respaldo");
    } finally {
      setImporting(false);
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
          <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0], "avatar")} />
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
          <input ref={backgroundInput} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0], "background")} />
          {backgroundUrl && <span className="self-center text-xs text-muted-foreground">Fondo cargado</span>}
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm font-medium">Ayudas contextuales</span>
          <Switch checked={help} onCheckedChange={(value) => setHelp.mutate(value)} />
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold">Sidebar: orden y visibilidad</h2>
        <p className="text-xs text-muted-foreground">La personalización se guarda por usuario.</p>
        {order.map((key, index) => {
          const item = NAV_ITEMS.find((x) => x.key === key);
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
        {WIDGETS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm">{label}</span>
            <Switch checked={widgets.includes(key)} onCheckedChange={(value) => setWidgets((current) => value ? (current.includes(key) ? current : [...current, key]) : current.filter((x) => x !== key))} />
          </div>
        ))}
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-semibold">Notificaciones y privacidad</h2>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm">Cumpleaños, aniversarios y citas médicas</span>
          <Switch checked={relationshipNotifications} onCheckedChange={setRelationshipNotifications} />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm">Permitir análisis externo de datos</span>
          <Switch checked={privacy} onCheckedChange={setPrivacy} />
        </div>
        <p className="text-xs text-muted-foreground">
          Los avisos locales requieren permiso del navegador. Los avisos cuando Personal OS está cerrado requieren las credenciales VAPID del servidor.
        </p>
        <Button variant="outline" onClick={() => void requestNotificationPermission()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Activar notificaciones en segundo plano
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