import { BookOpen, Heart, BriefcaseBusiness, Gamepad2, HeartHandshake, HeartPulse, Home, Trophy, User, Wallet, Church, ListTodo, Languages, CalendarDays, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  key: string;
  helpKey: string;
  search?: Record<string, string>;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: Home, key: "inicio", helpKey: "dashboard" },
  { to: "/organizacion", label: "Organización", icon: BriefcaseBusiness, key: "organizacion", helpKey: "habits" },
  { to: "/finanzas", label: "Finanzas", icon: Wallet, key: "finanzas", helpKey: "finance" },
  { to: "/salud", label: "Salud", icon: HeartPulse, key: "salud", helpKey: "health" },
  { to: "/diario", label: "Diario", icon: BookOpen, key: "diario", helpKey: "journal" },
  { to: "/emociones", label: "Emociones", icon: Heart, key: "emociones", helpKey: "life" },
  { to: "/vida", label: "Vida", icon: ListTodo, key: "vida", helpKey: "life" },
  { to: "/aprendizaje", label: "Aprendizaje", icon: Languages, key: "aprendizaje", helpKey: "learning" },
  { to: "/videojuegos", label: "Videojuegos", icon: Gamepad2, key: "videojuegos", helpKey: "learning" },
  { to: "/relaciones", label: "Relaciones", icon: HeartHandshake, key: "relaciones", helpKey: "relationships" },
  { to: "/espiritualidad", label: "Espiritualidad", icon: Church, key: "espiritualidad", helpKey: "spirituality" },
  { to: "/gamificacion", label: "Gamificación", icon: Trophy, key: "gamificacion", helpKey: "gamification" },
  { to: "/perfil", label: "Perfil", icon: User, key: "perfil", helpKey: "profile" },
];

const nav = (key: string) => {
  const item = NAV_ITEMS.find((candidate) => candidate.key === key);
  if (!item) throw new Error("Unknown navigation item: " + key);
  return item;
};

// Desktop navigation groups represent areas. Organization's three workspaces
// remain three distinct destinations inside the Organization area.
export const DESKTOP_NAV_GROUPS: NavGroup[] = [
  {
    key: "organizacion",
    label: "Organización",
    icon: BriefcaseBusiness,
    items: [
      { to: "/organizacion", label: "Hábitos", icon: Repeat, key: "habitos", helpKey: "habits", search: { tab: "habitos" } },
      { to: "/organizacion", label: "Planeador", icon: CalendarDays, key: "planeador", helpKey: "planner", search: { tab: "planeador" } },
      { to: "/organizacion", label: "Trabajo", icon: BriefcaseBusiness, key: "trabajo", helpKey: "work", search: { tab: "trabajo" } },
    ],
  },
  {
    key: "finanzas",
    label: "Finanzas",
    icon: Wallet,
    items: [nav("finanzas")],
  },
  {
    key: "bienestar",
    label: "Bienestar",
    icon: HeartPulse,
    items: [nav("salud"), nav("diario"), nav("emociones")],
  },
  {
    key: "vida",
    label: "Vida y relaciones",
    icon: HeartHandshake,
    items: [nav("vida"), nav("relaciones"), nav("espiritualidad")],
  },
  {
    key: "aprendizaje",
    label: "Aprendizaje y progreso",
    icon: BookOpen,
    items: [nav("aprendizaje"), nav("videojuegos"), nav("gamificacion")],
  },
];
