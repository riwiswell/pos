export type SkinId =
  | "classic" | "lego" | "dc-comics" | "marvel"
  | "star-wars" | "football" | "pixel" | "winamp";

export type SkinCollection = "Base" | "Universos" | "Estilos";

export interface SkinDefinition {
  id: SkinId;
  name: string;
  tagline: string;
  description: string;
  glyph: string;
  collection: SkinCollection;
  brandTitle: string;
  brandSubtitle: string;
  workspaceColor: { light: string; dark: string };
  preview: { background: string; sidebar: string; primary: string; accent: string };
}

export const DEFAULT_SKIN_ID: SkinId = "classic";

export const BUILT_IN_SKINS: SkinDefinition[] = [
  {
    id: "classic", name: "Personal OS", tagline: "Original",
    description: "La identidad original: limpia, equilibrada y discreta.",
    glyph: "◈", collection: "Base", brandTitle: "PERSONAL OS", brandSubtitle: "TU VIDA, EN ORDEN",
    workspaceColor: { light: "#F4F7FA", dark: "#20242C" },
    preview: { background: "#20242C", sidebar: "#171A21", primary: "#79D6D8", accent: "#F4F7FA" },
  },
  {
    id: "lego", name: "LEGO Universe", tagline: "Construye tu día",
    description: "Ladrillos, studs, minifiguras y módulos que parecen construidos pieza a pieza.",
    glyph: "🧱", collection: "Universos", brandTitle: "LEGO UNIVERSE", brandSubtitle: "BUILD YOUR DAILY LIFE",
    workspaceColor: { light: "#FFF4CF", dark: "#12213A" },
    preview: { background: "#FFF4CF", sidebar: "#0055BF", primary: "#D71920", accent: "#FFD500" },
  },
  {
    id: "dc-comics", name: "DC Universe", tagline: "Sombras y leyendas",
    description: "Una ciudad nocturna, portadas de cómic, señales heroicas y tipografía de impacto.",
    glyph: "🦇", collection: "Universos", brandTitle: "DC UNIVERSE", brandSubtitle: "LEGENDS NEVER REST",
    workspaceColor: { light: "#050A14", dark: "#050A14" },
    preview: { background: "#050A14", sidebar: "#02050B", primary: "#E32636", accent: "#F7C948" },
  },
  {
    id: "marvel", name: "Marvel Universe", tagline: "Héroes en acción",
    description: "Rojo de portada, azul eléctrico, viñetas, diagonales y energía de cómic.",
    glyph: "✦", collection: "Universos", brandTitle: "MARVEL", brandSubtitle: "HEROES IN ACTION",
    workspaceColor: { light: "#FBF1EE", dark: "#160C12" },
    preview: { background: "#170D13", sidebar: "#09090D", primary: "#ED1D24", accent: "#F5F5F5" },
  },
  {
    id: "star-wars", name: "Star Wars", tagline: "Una galaxia por explorar",
    description: "Espacio profundo, estrellas, paneles de nave y acentos dorados.",
    glyph: "✦", collection: "Universos", brandTitle: "STAR WARS", brandSubtitle: "A GALAXY OF POSSIBILITIES",
    workspaceColor: { light: "#F0EDDF", dark: "#060C1A" },
    preview: { background: "#060C1A", sidebar: "#030712", primary: "#E8C45A", accent: "#A9B9D0" },
  },
  {
    id: "football", name: "Fútbol", tagline: "Tu vida, en juego",
    description: "Césped, líneas de cancha, marcadores, escudos y tarjetas de partido.",
    glyph: "⚽", collection: "Universos", brandTitle: "FOOTBALL CLUB", brandSubtitle: "YOUR DAILY LEAGUE",
    workspaceColor: { light: "#EAF4E9", dark: "#0E2E1D" },
    preview: { background: "#0D321F", sidebar: "#062113", primary: "#22A45A", accent: "#F6F8F1" },
  },
  {
    id: "pixel", name: "Pixel World", tagline: "Aventura de 8 bits",
    description: "Mundos por bloques, píxeles visibles, misiones y una estética retro de videojuego.",
    glyph: "▦", collection: "Universos", brandTitle: "PIXEL WORLD", brandSubtitle: "DAILY QUESTS",
    workspaceColor: { light: "#E8F0DC", dark: "#182518" },
    preview: { background: "#1D2E1E", sidebar: "#101D13", primary: "#82B84A", accent: "#E7BC60" },
  },
  {
    id: "winamp", name: "Retro Digital", tagline: "Ritmo y tecnología",
    description: "Paneles metálicos, ecualizadores y luces neón: conserva la estética que te gustó, como estilo propio.",
    glyph: "▰", collection: "Estilos", brandTitle: "RETRO DIGITAL", brandSubtitle: "SYNC YOUR DAY",
    workspaceColor: { light: "#DCE2E6", dark: "#090D10" },
    preview: { background: "#101418", sidebar: "#090D10", primary: "#A3E635", accent: "#6B7280" },
  },
];

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && BUILT_IN_SKINS.some((skin) => skin.id === value);
}
