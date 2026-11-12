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
import { createElement, type CSSProperties } from "react";

/**
 * PERSONAL OS icon library.
 * Broad Lucide library with colorful object pictograms where a familiar object is more recognizable.
 */
type EmojiIconProps = { className?: string; style?: CSSProperties };
const emojiIcon = (emoji: string, label: string): LucideIcon => {
  const Component = ({ className, style }: EmojiIconProps) =>
    createElement("span", { className, style, role: "img", "aria-label": label }, emoji);
  return Component as unknown as LucideIcon;
};
const EXTRA_ICONS: Record<string, LucideIcon> = {
  Necktie: emojiIcon("👔", "Corbata"),
  Dress: emojiIcon("👗", "Vestido"),
  Shoes: emojiIcon("👟", "Zapatos"),
  Handbag: emojiIcon("👜", "Bolso"),
  Glasses: emojiIcon("👓", "Gafas"),
  Backpack: emojiIcon("🎒", "Mochila"),
  Perfume: emojiIcon("🧴", "Perfume"),
  Ring: emojiIcon("💍", "Anillo"),
  Luggage: emojiIcon("🧳", "Equipaje"),
  Passport: emojiIcon("🛂", "Pasaporte"),
  Motorcycle: emojiIcon("🏍️", "Motocicleta"),
  Scooter: emojiIcon("🛵", "Moto scooter"),
  Basketball: emojiIcon("🏀", "Baloncesto"),
  Football: emojiIcon("⚽", "Fútbol"),
  Tennis: emojiIcon("🎾", "Tenis"),
  Running: emojiIcon("🏃", "Correr"),
  Yoga: emojiIcon("🧘", "Yoga"),
  Medal: emojiIcon("🥇", "Medalla"),
  Trophy: emojiIcon("🏆", "Trofeo"),
  Plant: emojiIcon("🪴", "Planta"),
  Flower: emojiIcon("🌷", "Flor"),
  Butterfly: emojiIcon("🦋", "Mariposa"),
  Fish: emojiIcon("🐟", "Pez"),
  PawPrint: emojiIcon("🐾", "Huella"),
  Burger: emojiIcon("🍔", "Hamburguesa"),
  Cake: emojiIcon("🎂", "Pastel"),
  Bread: emojiIcon("🍞", "Pan"),
  Sushi: emojiIcon("🍣", "Sushi"),
  Milk: emojiIcon("🥛", "Leche"),
  Juice: emojiIcon("🧃", "Jugo"),
  Shampoo: emojiIcon("🧴", "Champú"),
  Toothbrush: emojiIcon("🪥", "Cepillo dental"),
  Soap: emojiIcon("🧼", "Jabón"),
  Hairdryer: emojiIcon("💇", "Secador y cuidado del cabello"),
  Calculator: emojiIcon("🧮", "Calculadora"),
  Printer: emojiIcon("🖨️", "Impresora"),
  Folder: emojiIcon("📁", "Carpeta"),
  Paperclip: emojiIcon("📎", "Clip"),
  Notebook: emojiIcon("📓", "Cuaderno"),
  Mail: emojiIcon("✉️", "Correo"),
  Tablet: emojiIcon("📱", "Tableta"),
  Monitor: emojiIcon("🖥️", "Monitor"),
  Projector: emojiIcon("📽️", "Proyector"),
  Battery: emojiIcon("🔋", "Batería"),
  Earbuds: emojiIcon("🎧", "Auriculares"),
};

export interface IconGroup {
  label: string;
  icons: string[];
}

export const ICON_GROUPS: IconGroup[] = [
  { label: "Finanzas", icons: ["Wallet", "Banknote", "PiggyBank", "CreditCard", "Coins", "Landmark", "HandCoins", "Receipt", "TrendingUp", "TrendingDown", "Gift", "BadgeDollarSign", "Vault", "Bitcoin"] },
  { label: "Viajes", icons: ["Luggage", "Passport", "Plane", "Train", "Ship", "Hotel"] },
  { label: "Transporte", icons: ["Car", "Bus", "Bike", "Fuel", "Plane", "Train", "TramFront", "ParkingCircle", "Ship", "Truck"] },
  { label: "Ropa y accesorios", icons: ["Necktie", "Dress", "Shoes", "Handbag", "Glasses", "Backpack", "Perfume", "Ring", "Shirt", "Gem", "Watch"] },
  { label: "Compras", icons: ["ShoppingCart", "ShoppingBag", "Store", "Tag", "Package"] },
  { label: "Comida y bebida", icons: ["Utensils", "Coffee", "Pizza", "Burger", "Cake", "Bread", "Sushi", "Milk", "Juice", "Beer", "Wine", "IceCream", "Apple", "Salad", "Sandwich", "CupSoda"] },
  { label: "Casa", icons: ["Home", "Sofa", "Bed", "Lightbulb", "Wrench", "Hammer", "Droplets", "Flame", "Trash2", "PaintRoller"] },
  { label: "Salud", icons: ["HeartPulse", "Stethoscope", "Pill", "Cross", "Dumbbell", "Activity", "Syringe"] },
  { label: "Belleza", icons: ["Scissors", "Sparkles", "Brush", "Bath"] },
  { label: "Cuidado personal", icons: ["Shampoo", "Toothbrush", "Soap", "Hairdryer", "Scissors", "Sparkles", "Brush", "Bath"] },
  { label: "Entretenimiento", icons: ["Music", "Clapperboard", "Gamepad2", "Ticket", "PartyPopper", "Tv", "Headphones", "Palette"] },
  { label: "Cuentas y servicios", icons: ["Wifi", "Smartphone", "PhoneCall", "Zap", "Cloud", "Server", "FileText"] },
  { label: "Rutina", icons: ["Sun", "Moon", "Repeat", "Timer", "CalendarDays", "ListChecks"] },
  { label: "Deporte", icons: ["Basketball", "Football", "Tennis", "Running", "Yoga", "Medal", "Trophy", "Dumbbell", "Bike"] },
  { label: "Relax", icons: ["TreePalm", "Waves", "Tent", "Mountain", "Hotel"] },
  { label: "Jardín y mascotas", icons: ["Plant", "Flower", "Butterfly", "Fish", "PawPrint", "Dog", "Cat"] },
  { label: "Educación", icons: ["GraduationCap", "BookOpen", "Library", "PenTool", "School"] },
  { label: "Familia", icons: ["Users", "Baby", "Dog", "Cat", "HeartHandshake", "Heart"] },
  { label: "Oficina", icons: ["Calculator", "Printer", "Folder", "Paperclip", "Notebook", "Mail", "Briefcase", "FileText", "PenTool"] },
  { label: "Electrónica", icons: ["Tablet", "Monitor", "Projector", "Battery", "Earbuds", "Smartphone", "Laptop", "Camera", "Gamepad2"] },
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
  ...EXTRA_ICONS,
};

export function getIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Circle;
}

/** Better context-aware defaults when displaying finance categories. */
export function getCategoryIconName(categoryName: string, fallback?: string | null): string {
  const name = categoryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/moto|gasolina|combustible/.test(name)) return /gasolina|combustible/.test(name) ? "Fuel" : "Bike";
  if (/comida|mercado|restaurante|pan|alimento/.test(name)) return "Utensils";
  if (/transporte|taxi|bus|parqueadero/.test(name)) return "Car";
  if (/juego|videojuego|entretenimiento/.test(name)) return "Gamepad2";
  if (/salud|medic|farmacia/.test(name)) return "HeartPulse";
  if (/internet|servicio|telefono|celular|tv|streaming/.test(name)) return "Wifi";
  if (/wiswellart|arte|clase|material/.test(name)) return "Palette";
  if (/diezmo|iglesia|ofrenda/.test(name)) return "Church";
  if (/casa|arriendo|hogar|vivienda/.test(name)) return "Home";
  if (/libro|educaci|estudio/.test(name)) return "BookOpen";
  if (/banco|credito|tarjeta|deuda/.test(name)) return "CreditCard";
  if (/ahorro|reserva|alcancia/.test(name)) return "PiggyBank";
  if (/regalo|ayuda|angela|reembolso/.test(name)) return "HandCoins";
  return fallback || "Circle";
}
