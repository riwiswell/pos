import {
  Wallet, Banknote, PiggyBank, CreditCard, Coins, Landmark, HandCoins, Receipt, TrendingUp, TrendingDown, Gift, BadgeDollarSign, Vault, Bitcoin,
  Car, Bus, Bike, Fuel, Plane, Train, TramFront, ParkingCircle, Ship, Truck,
  ShoppingCart, ShoppingBag, Store, Tag, Package, Shirt, Gem, Watch,
  Utensils, Coffee, Pizza, Beer, Wine, IceCream, Apple, Salad, Sandwich, CupSoda,
  Home, Sofa, Bed, Lightbulb, Wrench, Hammer, Droplets, Flame, Trash2, PaintRoller,
  HeartPulse, Stethoscope, Pill, Cross, Dumbbell, Activity, Syringe,
  Scissors, Sparkles, Brush, Bath,
  Music, Clapperboard, Gamepad2, Ticket, PartyPopper, Tv, Headphones, Palette,
  Wifi, Smartphone, PhoneCall, Zap, Cloud, Server, FileText,
  Sun, Moon, Repeat, Timer, CalendarDays, ListChecks,
  TreePalm, Waves, Tent, Mountain, Hotel,
  GraduationCap, BookOpen, Library, PenTool, School,
  Users, Baby, Dog, Cat, HeartHandshake, Heart,
  Briefcase, Laptop, Building2, Hammer as Tools, Handshake, Presentation,
  Church, Star, Circle, MoreHorizontal, HelpCircle, Bookmark, MapPin, Camera,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * PERSONAL OS icon library.
 * Minimal, coherent, and deliberately broad — no emojis used as a substitute.
 */
export interface IconGroup {
  label: string;
  icons: string[];
}

export const ICON_GROUPS: IconGroup[] = [
  { label: "Finanzas", icons: ["Wallet", "Banknote", "PiggyBank", "CreditCard", "Coins", "Landmark", "HandCoins", "Receipt", "TrendingUp", "TrendingDown", "Gift", "BadgeDollarSign", "Vault", "Bitcoin"] },
  { label: "Transporte", icons: ["Car", "Bus", "Bike", "Fuel", "Plane", "Train", "TramFront", "ParkingCircle", "Ship", "Truck"] },
  { label: "Compras", icons: ["ShoppingCart", "ShoppingBag", "Store", "Tag", "Package", "Shirt", "Gem", "Watch"] },
  { label: "Comida y bebida", icons: ["Utensils", "Coffee", "Pizza", "Beer", "Wine", "IceCream", "Apple", "Salad", "Sandwich", "CupSoda"] },
  { label: "Casa", icons: ["Home", "Sofa", "Bed", "Lightbulb", "Wrench", "Hammer", "Droplets", "Flame", "Trash2", "PaintRoller"] },
  { label: "Salud", icons: ["HeartPulse", "Stethoscope", "Pill", "Cross", "Dumbbell", "Activity", "Syringe"] },
  { label: "Belleza", icons: ["Scissors", "Sparkles", "Brush", "Bath"] },
  { label: "Entretenimiento", icons: ["Music", "Clapperboard", "Gamepad2", "Ticket", "PartyPopper", "Tv", "Headphones", "Palette"] },
  { label: "Cuentas y servicios", icons: ["Wifi", "Smartphone", "PhoneCall", "Zap", "Cloud", "Server", "FileText"] },
  { label: "Rutina", icons: ["Sun", "Moon", "Repeat", "Timer", "CalendarDays", "ListChecks"] },
  { label: "Relax", icons: ["TreePalm", "Waves", "Tent", "Mountain", "Hotel"] },
  { label: "Educación", icons: ["GraduationCap", "BookOpen", "Library", "PenTool", "School"] },
  { label: "Familia", icons: ["Users", "Baby", "Dog", "Cat", "HeartHandshake", "Heart"] },
  { label: "Trabajo", icons: ["Briefcase", "Laptop", "Building2", "Handshake", "Presentation"] },
  { label: "Otros", icons: ["Church", "Star", "Circle", "MoreHorizontal", "HelpCircle", "Bookmark", "MapPin", "Camera"] },
];

export const ICONS: Record<string, LucideIcon> = {
  Wallet, Banknote, PiggyBank, CreditCard, Coins, Landmark, HandCoins, Receipt, TrendingUp, TrendingDown, Gift, BadgeDollarSign, Vault, Bitcoin,
  Car, Bus, Bike, Fuel, Plane, Train, TramFront, ParkingCircle, Ship, Truck,
  ShoppingCart, ShoppingBag, Store, Tag, Package, Shirt, Gem, Watch,
  Utensils, Coffee, Pizza, Beer, Wine, IceCream, Apple, Salad, Sandwich, CupSoda,
  Home, Sofa, Bed, Lightbulb, Wrench, Hammer, Droplets, Flame, Trash2, PaintRoller,
  HeartPulse, Stethoscope, Pill, Cross, Dumbbell, Activity, Syringe,
  Scissors, Sparkles, Brush, Bath,
  Music, Clapperboard, Gamepad2, Ticket, PartyPopper, Tv, Headphones, Palette,
  Wifi, Smartphone, PhoneCall, Zap, Cloud, Server, FileText,
  Sun, Moon, Repeat, Timer, CalendarDays, ListChecks,
  TreePalm, Waves, Tent, Mountain, Hotel,
  GraduationCap, BookOpen, Library, PenTool, School,
  Users, Baby, Dog, Cat, HeartHandshake, Heart,
  Briefcase, Laptop, Building2, Tools, Handshake, Presentation,
  Church, Star, Circle, MoreHorizontal, HelpCircle, Bookmark, MapPin, Camera,
};

export function getIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Circle;
}