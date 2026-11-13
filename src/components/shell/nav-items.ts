import { BookOpen, CalendarCheck, Gamepad2, HeartHandshake, HeartPulse, Home, Trophy, User, Repeat, Wallet, BriefcaseBusiness, Church, ListTodo, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  group?: string;
  to: string;
  label: string;
  icon: LucideIcon;
  key: string;
  helpKey: string;
}

export const NAV_GROUPS = ["Organización", "Bienestar", "Vida", "Aprendizaje", "Entretenimiento", "Progreso"] as const;

export const NAV_ITEMS: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: Home, key: "inicio", helpKey: "dashboard" },
  { group: "Organización", to: "/habitos", label: "Hábitos", icon: Repeat, key: "habitos", helpKey: "habits" },
  { group: "Organización", to: "/planeador", label: "Planeador", icon: CalendarCheck, key: "planeador", helpKey: "planner" },
  { group: "Bienestar", to: "/salud", label: "Salud", icon: HeartPulse, key: "salud", helpKey: "health" },
  { group: "Bienestar", to: "/finanzas", label: "Finanzas", icon: Wallet, key: "finanzas", helpKey: "finance" },
  { group: "Vida", to: "/diario", label: "Diario", icon: BookOpen, key: "diario", helpKey: "journal" },
  { group: "Vida", to: "/vida", label: "Vida", icon: ListTodo, key: "vida", helpKey: "life" },
  { group: "Aprendizaje", to: "/aprendizaje", label: "Aprendizaje", icon: Languages, key: "aprendizaje", helpKey: "learning" },
  { group: "Entretenimiento", to: "/videojuegos", label: "Videojuegos", icon: Gamepad2, key: "videojuegos", helpKey: "learning" },
  { group: "Vida", to: "/relaciones", label: "Relaciones", icon: HeartHandshake, key: "relaciones", helpKey: "relationships" },
  { group: "Organización", to: "/trabajo", label: "Trabajo", icon: BriefcaseBusiness, key: "trabajo", helpKey: "work" },
  { group: "Vida", to: "/espiritualidad", label: "Espiritualidad", icon: Church, key: "espiritualidad", helpKey: "spirituality" },
  { group: "Progreso", to: "/gamificacion", label: "Gamificación", icon: Trophy, key: "gamificacion", helpKey: "gamification" },
  { to: "/perfil", label: "Perfil", icon: User, key: "perfil", helpKey: "profile" },
];
