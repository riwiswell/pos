import { AlarmClock, BookOpen, CalendarCheck, HeartHandshake, HeartPulse, Home, Brain, Trophy, User, Repeat, Wallet, BriefcaseBusiness, Church, ListTodo, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  key: string;
  helpKey: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: Home, key: "inicio", helpKey: "dashboard" },
  { to: "/habitos", label: "Hábitos", icon: Repeat, key: "habitos", helpKey: "habits" },
  { to: "/planeador", label: "Planeador", icon: CalendarCheck, key: "planeador", helpKey: "planner" },
  { to: "/salud", label: "Salud", icon: HeartPulse, key: "salud", helpKey: "health" },
  { to: "/finanzas", label: "Finanzas", icon: Wallet, key: "finanzas", helpKey: "finance" },
  { to: "/diario", label: "Diario", icon: BookOpen, key: "diario", helpKey: "journal" },
  { to: "/alarmas", label: "Alarmas", icon: AlarmClock, key: "alarmas", helpKey: "life.alarms" },
  { to: "/vida", label: "Vida", icon: ListTodo, key: "vida", helpKey: "life" },
  { to: "/aprendizaje", label: "Aprendizaje", icon: Languages, key: "aprendizaje", helpKey: "learning" },
  { to: "/relaciones", label: "Relaciones", icon: HeartHandshake, key: "relaciones", helpKey: "relationships" },
  { to: "/trabajo", label: "Trabajo", icon: BriefcaseBusiness, key: "trabajo", helpKey: "work" },
  { to: "/espiritualidad", label: "Espiritualidad", icon: Church, key: "espiritualidad", helpKey: "spirituality" },
  { to: "/ia", label: "IA Personal", icon: Brain, key: "ia", helpKey: "ai.personal" },
  { to: "/gamificacion", label: "Gamificación", icon: Trophy, key: "gamificacion", helpKey: "gamification" },
  { to: "/perfil", label: "Perfil", icon: User, key: "perfil", helpKey: "profile" },
];
