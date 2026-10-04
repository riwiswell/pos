import { BookOpen, CalendarCheck, HeartPulse, Home, Repeat, User, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Visible PERSONAL OS domains.
 * A domain is added here ONLY when it has real functionality. No dead links.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/habitos", label: "Hábitos", icon: Repeat },
  { to: "/planeador", label: "Planeador", icon: CalendarCheck },
  { to: "/salud", label: "Salud", icon: HeartPulse },
  { to: "/finanzas", label: "Finanzas", icon: Wallet },
  { to: "/diario", label: "Diario", icon: BookOpen },
  { to: "/perfil", label: "Perfil", icon: User },
];