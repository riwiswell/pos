import { BookOpen, BriefcaseBusiness, CalendarCheck, Gamepad2, HeartHandshake, HeartPulse, Home, Trophy, User, Wallet, Church, ListTodo, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  key: string;
  helpKey: string;
}

// Navigation remains a flat, user-reorderable list. Related workspaces are
// grouped inside their own module, not hidden behind sidebar accordions.
export const NAV_GROUPS: readonly string[] = [];

export const NAV_ITEMS: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: Home, key: "inicio", helpKey: "dashboard" },
  { to: "/organizacion", label: "Organización", icon: BriefcaseBusiness, key: "organizacion", helpKey: "habits" },
  { to: "/salud", label: "Salud", icon: HeartPulse, key: "salud", helpKey: "health" },
  { to: "/finanzas", label: "Finanzas", icon: Wallet, key: "finanzas", helpKey: "finance" },
  { to: "/diario", label: "Diario", icon: BookOpen, key: "diario", helpKey: "journal" },
  { to: "/vida", label: "Vida", icon: ListTodo, key: "vida", helpKey: "life" },
  { to: "/aprendizaje", label: "Aprendizaje", icon: Languages, key: "aprendizaje", helpKey: "learning" },
  { to: "/videojuegos", label: "Videojuegos", icon: Gamepad2, key: "videojuegos", helpKey: "learning" },
  { to: "/relaciones", label: "Relaciones", icon: HeartHandshake, key: "relaciones", helpKey: "relationships" },
  { to: "/espiritualidad", label: "Espiritualidad", icon: Church, key: "espiritualidad", helpKey: "spirituality" },
  { to: "/gamificacion", label: "Gamificación", icon: Trophy, key: "gamificacion", helpKey: "gamification" },
  { to: "/perfil", label: "Perfil", icon: User, key: "perfil", helpKey: "profile" },
];
