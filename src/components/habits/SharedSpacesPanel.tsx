import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Flag, HeartHandshake, Plus, Share2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { todayISO } from "@/lib/date";

const db = supabase as any;
const SHARED_TABLES = {
  spaces: "personal_shared_spaces",
  members: "personal_shared_space_members",
  invites: "personal_shared_space_invites",
  habits: "personal_shared_habits",
  logs: "personal_shared_habit_logs",
  goals: "personal_shared_goals",
  contributions: "personal_shared_goal_contributions",
  points: "personal_shared_points_ledger",
} as const;

type Space = { id: string; name: string; owner_id: string; created_at: string };
type SharedHabit = {
  id: string; name: string; icon: string | null; kind: "habit" | "activity";
  tracking_type: "check" | "counter"; target: number | null; unit: string | null; active: boolean;
};
type SharedGoal = {
  id: string; title: string; description: string | null; icon: string | null;
  target: number; progress: number; unit: string | null; reward_points: number;
  goal_type: "goal" | "challenge"; status: string; ends_on: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

export function SharedSpacesPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [spaceName, setSpaceName] = useState("Ricardo + Angie");
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("angiediaz456@gmail.com");
  const [inviteCode, setInviteCode] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [habitName, setHabitName] = useState("");
  const [habitIcon, setHabitIcon] = useState("❤️");
  const [habitKind, setHabitKind] = useState<"habit" | "activity">("habit");
  const [habitType, setHabitType] = useState<"check" | "counter">("check");
  const [habitTarget, setHabitTarget] = useState("1");
  const [habitUnit, setHabitUnit] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("1");
  const [goalReward, setGoalReward] = useState("50");

  const spacesQuery = useQuery({
    queryKey: ["shared-spaces"],
    queryFn: async () => {
      const { data, error } = await db.from(SHARED_TABLES.spaces).select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Space[];
    },
  });

  useEffect(() => {
    const spaces = spacesQuery.data ?? [];
    if (!selectedSpaceId && spaces.length) setSelectedSpaceId(spaces[0]!.id);
    if (selectedSpaceId && !spaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(spaces[0]?.id ?? "");
    }
  }, [spacesQuery.data, selectedSpaceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("sharedInvite");
    if (code) setInviteCode(code);
  }, []);

  const membersQuery = useQuery({
    queryKey: ["shared-space-members", selectedSpaceId],
    enabled: Boolean(selectedSpaceId),
    queryFn: async () => {
      const { data, error } = await db.from(SHARED_TABLES.members).select("*").eq("space_id", selectedSpaceId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const invitesQuery = useQuery({
    queryKey: ["shared-space-invites", selectedSpaceId],
    enabled: Boolean(selectedSpaceId),
    queryFn: async () => {
      const { data, error } = await db.from(SHARED_TABLES.invites).select("*").eq("space_id", selectedSpaceId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const habitsQuery = useQuery({
    queryKey: ["shared-space-habits", selectedSpaceId],
    enabled: Boolean(selectedSpaceId),
    queryFn: async () => {
      const { data, error } = await db.from(SHARED_TABLES.habits).select("*").eq("space_id", selectedSpaceId).eq("active", true).order("position");
      if (error) throw error;
      return (data ?? []) as SharedHabit[];
    },
  });
  const logsQuery = useQuery({
    queryKey: ["shared-space-logs", selectedSpaceId, todayISO()],
    enabled: Boolean(selectedSpaceId) && Boolean(habitsQuery.data?.length),
    queryFn: async () => {
      const ids = (habitsQuery.data ?? []).map((habit) => habit.id);
      if (!ids.length) return [];
      const { data, error } = await db.from(SHARED_TABLES.logs).select("*").in("shared_habit_id", ids).eq("log_date", todayISO());
      if (error) throw error;
      return data ?? [];
    },
  });
  const goalsQuery = useQuery({
    queryKey: ["shared-space-goals", selectedSpaceId],
    enabled: Boolean(selectedSpaceId),
    queryFn: async () => {
      const { data, error } = await db.from(SHARED_TABLES.goals).select("*").eq("space_id", selectedSpaceId).in("status", ["active", "completed"]).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SharedGoal[];
    },
  });
  const pointsQuery = useQuery({
    queryKey: ["shared-space-points", selectedSpaceId],
    enabled: Boolean(selectedSpaceId),
    queryFn: async () => {
      const { data, error } = await db.from(SHARED_TABLES.points).select("points").eq("space_id", selectedSpaceId);
      if (error) throw error;
      return (data ?? []).reduce((total: number, row: { points: number }) => total + Number(row.points || 0), 0);
    },
  });

  const invalidateSpace = () => {
    void queryClient.invalidateQueries({ queryKey: ["shared-spaces"] });
    void queryClient.invalidateQueries({ queryKey: ["shared-space-members", selectedSpaceId] });
    void queryClient.invalidateQueries({ queryKey: ["shared-space-invites", selectedSpaceId] });
    void queryClient.invalidateQueries({ queryKey: ["shared-space-habits", selectedSpaceId] });
    void queryClient.invalidateQueries({ queryKey: ["shared-space-logs", selectedSpaceId] });
    void queryClient.invalidateQueries({ queryKey: ["shared-space-goals", selectedSpaceId] });
    void queryClient.invalidateQueries({ queryKey: ["shared-space-points", selectedSpaceId] });
  };

  const createSpace = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Inicia sesión para crear un espacio compartido.");
      const name = spaceName.trim();
      if (!name) throw new Error("Escribe un nombre para el espacio.");
      const { data, error } = await db.from(SHARED_TABLES.spaces).insert({ owner_id: user.id, name }).select("*").single();
      if (error) throw error;
      return data as Space;
    },
    onSuccess: (space) => {
      setSelectedSpaceId(space.id);
      void queryClient.invalidateQueries({ queryKey: ["shared-spaces"] });
      toast.success("Espacio compartido creado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const createInvite = useMutation({
    mutationFn: async () => {
      if (!selectedSpaceId || !user?.id) throw new Error("Selecciona un espacio compartido.");
      const email = inviteEmail.trim().toLowerCase();
      if (!email.includes("@")) throw new Error("Escribe un correo válido.");
      const { data, error } = await db.from(SHARED_TABLES.invites).insert({
        space_id: selectedSpaceId, invited_email: email, invited_by: user.id,
      }).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (invite) => {
      const url = typeof window !== "undefined"
        ? window.location.origin + window.location.pathname + "?sharedInvite=" + invite.invite_code
        : "?sharedInvite=" + invite.invite_code;
      setLastInviteLink(url);
      void queryClient.invalidateQueries({ queryKey: ["shared-space-invites", selectedSpaceId] });
      toast.success("Invitación creada. Comparte el enlace con esa persona.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const acceptInvite = useMutation({
    mutationFn: async () => {
      const code = inviteCode.trim();
      if (!code) throw new Error("Pega el código de la invitación.");
      const { data, error } = await db.rpc("accept_personal_shared_invite", { p_invite_code: code });
      if (error) throw error;
      return String(data);
    },
    onSuccess: (spaceId) => {
      setSelectedSpaceId(spaceId);
      setInviteCode("");
      toast.success("Ya formas parte del espacio compartido.");
      void queryClient.invalidateQueries({ queryKey: ["shared-spaces"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const createHabit = useMutation({
    mutationFn: async () => {
      if (!selectedSpaceId || !user?.id) throw new Error("Selecciona un espacio.");
      const name = habitName.trim();
      if (!name) throw new Error("Escribe el nombre del hábito o actividad.");
      const numericTarget = Number(habitTarget.replace(",", "."));
      const { error } = await db.from(SHARED_TABLES.habits).insert({
        space_id: selectedSpaceId, created_by: user.id, name, icon: habitIcon,
        kind: habitKind, tracking_type: habitType,
        target: habitType === "counter" && numericTarget > 0 ? numericTarget : null,
        unit: habitType === "counter" ? habitUnit.trim() || null : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setHabitName("");
      invalidateSpace();
      toast.success("Hábito compartido creado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const saveLog = useMutation({
    mutationFn: async ({ habit, current }: { habit: SharedHabit; current: any }) => {
      if (!user?.id) throw new Error("Inicia sesión para registrar tu participación.");
      const isCounter = habit.tracking_type === "counter";
      const value = isCounter ? Number(current?.value ?? 0) + 1 : (current?.completed ? 0 : 1);
      const { error } = await db.from(SHARED_TABLES.logs).upsert({
        shared_habit_id: habit.id, user_id: user.id, log_date: todayISO(),
        completed: isCounter ? value > 0 : value === 1, value,
      }, { onConflict: "shared_habit_id,user_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shared-space-logs", selectedSpaceId] }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const createGoal = useMutation({
    mutationFn: async () => {
      if (!selectedSpaceId || !user?.id) throw new Error("Selecciona un espacio.");
      const title = goalTitle.trim();
      const target = Number(goalTarget.replace(",", "."));
      const reward = Number(goalReward);
      if (!title) throw new Error("Escribe el nombre de la meta.");
      if (!Number.isFinite(target) || target <= 0) throw new Error("La meta debe ser mayor que cero.");
      if (!Number.isInteger(reward) || reward < 0) throw new Error("Los puntos deben ser un entero igual o mayor que cero.");
      const { error } = await db.from(SHARED_TABLES.goals).insert({
        space_id: selectedSpaceId, created_by: user.id, title,
        target, reward_points: reward, goal_type: "challenge",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGoalTitle("");
      invalidateSpace();
      toast.success("Reto compartido creado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const contribute = useMutation({
    mutationFn: async (goal: SharedGoal) => {
      if (!user?.id) throw new Error("Inicia sesión para aportar.");
      const { error } = await db.from(SHARED_TABLES.contributions).insert({
        goal_id: goal.id, user_id: user.id, amount: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shared-space-goals", selectedSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["shared-space-points", selectedSpaceId] });
      toast.success("Aporte registrado. ¡El reto avanza!");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const activeSpace = (spacesQuery.data ?? []).find((space) => space.id === selectedSpaceId);
  const todayLogs = logsQuery.data ?? [];
  const byHabit = useMemo(() => new Map(todayLogs.map((log: any) => [log.shared_habit_id + "|" + log.user_id, log])), [todayLogs]);
  const invites = invitesQuery.data ?? [];
  const acceptedInviteByUser = new Map(invites.filter((invite: any) => invite.status === "accepted" && invite.accepted_by).map((invite: any) => [invite.accepted_by, invite.invited_email]));
  const totalPoints = Number(pointsQuery.data ?? 0);
  const loading = spacesQuery.isLoading || (Boolean(selectedSpaceId) && (membersQuery.isLoading || habitsQuery.isLoading || goalsQuery.isLoading));
  const queryError = spacesQuery.error ?? membersQuery.error ?? habitsQuery.error ?? goalsQuery.error;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-card to-rose-400/10 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-background/80"><HeartHandshake className="h-6 w-6 text-primary" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">En equipo</p><h2 className="text-xl font-semibold">Hábitos compartidos</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Un espacio para construir rutinas, experiencias y metas en común, sin mezclar los registros privados.</p></div>
          </div>
          {activeSpace && <div className="rounded-xl border bg-background/70 px-3 py-2 text-right"><p className="text-2xl font-bold tabular-nums">{totalPoints}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Puntos del equipo</p></div>}
        </div>
      </section>

      {spacesQuery.isError ? (
        <div className="rounded-2xl border border-destructive/40 p-4 text-sm text-destructive">{errorMessage(spacesQuery.error)}</div>
      ) : (spacesQuery.data ?? []).length === 0 ? (
        <section className="rounded-2xl border border-dashed p-5">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h3 className="font-semibold">Crea vuestro primer espacio</h3></div>
          <p className="mt-1 text-sm text-muted-foreground">Después podrás invitar a Angie y empezar a sumar hábitos, experiencias y retos entre los dos.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder="Nombre del espacio" /><Button disabled={!spaceName.trim() || createSpace.isPending} onClick={() => createSpace.mutate()}><Plus className="mr-1 h-4 w-4" />{createSpace.isPending ? "Creando…" : "Crear espacio"}</Button></div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="shared-space-select" className="text-xs text-muted-foreground">Espacio</Label>
            <select id="shared-space-select" className="h-10 min-w-48 rounded-xl border bg-background px-3 text-sm" value={selectedSpaceId} onChange={(event) => setSelectedSpaceId(event.target.value)}>
              {(spacesQuery.data ?? []).map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => createSpace.mutate()} disabled={createSpace.isPending}><Plus className="mr-1 h-3.5 w-3.5" />Nuevo espacio</Button>
          </div>

          <section className="glass space-y-3 rounded-2xl p-4">
            <div className="flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Invitar a alguien</h3></div>
            <p className="text-xs text-muted-foreground">La invitación queda vinculada al correo indicado. La persona debe iniciar sesión con ese correo para aceptarla.</p>
            <div className="flex flex-col gap-2 sm:flex-row"><Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="correo@ejemplo.com" /><Button disabled={!inviteEmail.includes("@") || createInvite.isPending} onClick={() => createInvite.mutate()}>Crear invitación</Button></div>
            {lastInviteLink && <div className="rounded-xl border bg-background/70 p-3"><p className="text-xs font-medium">Enlace de invitación</p><p className="mt-1 break-all text-xs text-muted-foreground">{lastInviteLink}</p><Button size="sm" variant="outline" className="mt-2" onClick={() => { void navigator.clipboard.writeText(lastInviteLink).then(() => toast.success("Enlace copiado."), () => toast.error("No se pudo copiar el enlace.")); }}><Copy className="mr-1 h-3.5 w-3.5" />Copiar enlace</Button></div>}
            {(invites ?? []).filter((invite: any) => invite.status === "pending").map((invite: any) => <p key={invite.id} className="text-xs text-muted-foreground">Pendiente: {invite.invited_email} · vence {String(invite.expires_at).slice(0,10)}</p>)}
            <div className="border-t pt-3"><Label htmlFor="shared-invite-code" className="text-xs">¿Tienes un código de invitación?</Label><div className="mt-1 flex gap-2"><Input id="shared-invite-code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Pega aquí el código" /><Button variant="outline" disabled={!inviteCode.trim() || acceptInvite.isPending} onClick={() => acceptInvite.mutate()}>Aceptar</Button></div></div>
          </section>

          <section className="glass space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Personas del equipo</h3><p className="text-xs text-muted-foreground">Cada persona registra su propia participación.</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{membersQuery.data?.length ?? 0} miembros</span></div>
            {(membersQuery.data ?? []).map((member: any, index: number) => {
              const email = member.user_id === user?.id ? user?.email : acceptedInviteByUser.get(member.user_id);
              const label = email || "Miembro " + (index + 1);
              return <div key={member.user_id} className="flex items-center gap-2 rounded-xl border p-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold">{String(label).slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm">{label === user?.email ? "Tú" : label}</span><span className="text-[10px] uppercase text-muted-foreground">{member.role === "owner" ? "Propietario" : "Miembro"}</span></div>;
            })}
          </section>

          <section className="glass space-y-4 rounded-2xl p-4">
            <div><h3 className="font-semibold">Hábitos y actividades del equipo</h3><p className="text-xs text-muted-foreground">Por ejemplo: besarse al levantarse, salir a cenar o jugar juntos. Cada uno confirma lo que hizo.</p></div>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px_130px_110px_auto]">
              <Input value={habitName} onChange={(event) => setHabitName(event.target.value)} placeholder="Nombre del hábito o actividad" />
              <Input value={habitIcon} onChange={(event) => setHabitIcon(event.target.value)} placeholder="❤️" aria-label="Icono" />
              <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={habitKind} onChange={(event) => setHabitKind(event.target.value as "habit" | "activity")}><option value="habit">Hábito diario</option><option value="activity">Actividad</option></select>
              <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={habitType} onChange={(event) => setHabitType(event.target.value as "check" | "counter")}><option value="check">Casilla</option><option value="counter">Contador</option></select>
              <Button disabled={!habitName.trim() || createHabit.isPending} onClick={() => createHabit.mutate()}><Plus className="mr-1 h-4 w-4" />Crear</Button>
            </div>
            {habitType === "counter" && <div className="grid max-w-sm grid-cols-2 gap-2"><Input value={habitTarget} onChange={(event) => setHabitTarget(event.target.value)} placeholder="Meta" /><Input value={habitUnit} onChange={(event) => setHabitUnit(event.target.value)} placeholder="Unidad" /></div>}
            <div className="grid gap-2 sm:grid-cols-2">
              {(habitsQuery.data ?? []).map((habit) => {
                const mine = byHabit.get(habit.id + "|" + user?.id) as any;
                const done = habit.tracking_type === "counter" ? Number(mine?.value ?? 0) >= Number(habit.target ?? 1) : Boolean(mine?.completed);
                return <article key={habit.id} className="flex items-center gap-3 rounded-xl border bg-background/60 p-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl">{habit.icon || (habit.kind === "activity" ? "🎯" : "✨")}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{habit.name}</p><p className="text-xs text-muted-foreground">{habit.kind === "activity" ? "Actividad" : "Hábito"} · {habit.tracking_type === "counter" ? String(mine?.value ?? 0) + "/" + String(habit.target ?? 1) + " " + (habit.unit ?? "") : done ? "Registrado hoy" : "Pendiente hoy"}</p></div>
                  <Button size="sm" variant={done ? "secondary" : "default"} disabled={saveLog.isPending || (done && habit.tracking_type === "check")} onClick={() => saveLog.mutate({ habit, current: mine })}>{habit.tracking_type === "counter" ? "+1" : done ? <Check className="h-4 w-4" /> : "Hecho"}</Button>
                </article>;
              })}
            </div>
            {(!habitsQuery.data || habitsQuery.data.length === 0) && <p className="text-sm text-muted-foreground">Aún no hay hábitos compartidos.</p>}
          </section>

          <section className="glass space-y-4 rounded-2xl p-4">
            <div className="flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /><div><h3 className="font-semibold">Metas y retos en común</h3><p className="text-xs text-muted-foreground">Cada aporte suma al objetivo conjunto. Los puntos se entregan una sola vez al completarlo.</p></div></div>
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_100px_auto]"><Input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Ej. Completar LEGO Star Wars juntos" /><Input value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="Meta" /><Input value={goalReward} onChange={(event) => setGoalReward(event.target.value)} placeholder="Puntos" /><Button disabled={!goalTitle.trim() || createGoal.isPending} onClick={() => createGoal.mutate()}><Plus className="mr-1 h-4 w-4" />Crear reto</Button></div>
            <div className="space-y-2">
              {(goalsQuery.data ?? []).map((goal) => {
                const percent = Math.min(100, Math.round(Number(goal.progress) / Number(goal.target) * 100));
                return <article key={goal.id} className="rounded-xl border bg-background/60 p-3">
                  <div className="flex items-start gap-2"><span className="text-xl">{goal.icon || "🏆"}</span><div className="min-w-0 flex-1"><p className="font-semibold">{goal.title}</p><p className="text-xs text-muted-foreground">{Number(goal.progress).toLocaleString("es-CO")} / {Number(goal.target).toLocaleString("es-CO")} {goal.unit ?? "aportes"} · {goal.reward_points} puntos</p></div><span className="text-xs font-semibold tabular-nums">{percent}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-400 transition-all" style={{ width: percent + "%" }} /></div>
                  <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{goal.status === "completed" ? "¡Reto completado!" : "Suma tu aporte"}</span><Button size="sm" variant="outline" disabled={goal.status === "completed" || contribute.isPending} onClick={() => contribute.mutate(goal)}>+1 aporte</Button></div>
                </article>;
              })}
              {(goalsQuery.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay retos en común.</p>}
            </div>
          </section>
        </>
      )}

      {queryError && <p className="text-xs text-destructive">{errorMessage(queryError)}</p>}
      {loading && <p className="text-xs text-muted-foreground">Cargando espacio compartido…</p>}
      <p className="text-[11px] text-muted-foreground">Los espacios compartidos viven en tablas separadas. No modifican el historial privado de hábitos ni el XP individual.</p>
    </div>
  );
}
