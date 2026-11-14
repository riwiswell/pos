export type SkinId = "classic" | "lego" | "dc-comics" | "winamp";

export interface SkinDefinition {
  id: SkinId;
  name: string;
  tagline: string;
  description: string;
  glyph: string;
  preview: {
    background: string;
    sidebar: string;
    primary: string;
    accent: string;
  };
}

export const DEFAULT_SKIN_ID: SkinId = "classic";

export const BUILT_IN_SKINS: SkinDefinition[] = [
  {
    id: "classic",
    name: "Personal OS",
    tagline: "Original",
    description: "La identidad visual base, limpia y equilibrada.",
    glyph: "◈",
    preview: { background: "#20242C", sidebar: "#171A21", primary: "#79D6D8", accent: "#F4F7FA" },
  },
  {
    id: "lego",
    name: "LEGO",
    tagline: "Bloques y color",
    description: "Colores primarios, superficies sólidas y controles contundentes.",
    glyph: "🧱",
    preview: { background: "#FFF0B3", sidebar: "#0055BF", primary: "#D71920", accent: "#FFD500" },
  },
  {
    id: "dc-comics",
    name: "DC Comics",
    tagline: "Cómic heroico",
    description: "Contraste cinematográfico, azul profundo, rojo y acentos dorados.",
    glyph: "⚡",
    preview: { background: "#101B37", sidebar: "#071226", primary: "#E32636", accent: "#F7C948" },
  },
  {
    id: "winamp",
    name: "Winamp",
    tagline: "Retro digital",
    description: "Paneles compactos, metal oscuro y acentos verde neón.",
    glyph: "▰",
    preview: { background: "#101418", sidebar: "#090D10", primary: "#A3E635", accent: "#6B7280" },
  },
];

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && BUILT_IN_SKINS.some((skin) => skin.id === value);
}
