export type SkinId =
  | "classic" | "lego" | "dc-comics" | "marvel"
  | "star-wars" | "football" | "pixel" | "winamp"
  | "nintendo" | "pokemon" | "resident-evil" | "zelda" | "mario" | "chess";

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
  },,
  {
    id: "nintendo", name: "Nintendo World", tagline: "Play your day",
    description: "Una consola convertida en espacio de juego: botones icónicos, paneles limpios y energía de Nintendo.",
    glyph: "🎮", collection: "Universos", brandTitle: "NINTENDO WORLD", brandSubtitle: "PLAY YOUR DAILY LIFE",
    workspaceColor: { light: "#F1F3F7", dark: "#111827" },
    preview: { background: "#111827", sidebar: "#0B1220", primary: "#E60012", accent: "#FFD928" },
  },
  {
    id: "pokemon", name: "Pokémon", tagline: "Atrapa el día",
    description: "Una aventura de entrenador: Poké Ball, rutas, medallas, energía eléctrica y colores de criaturas.",
    glyph: "⚡", collection: "Universos", brandTitle: "POKÉMON TRAINER", brandSubtitle: "CATCH YOUR DAY",
    workspaceColor: { light: "#EAF2FC", dark: "#111A31" },
    preview: { background: "#17294B", sidebar: "#0B1428", primary: "#2E75CC", accent: "#FFD928" },
  },
  {
    id: "resident-evil", name: "Resident Evil", tagline: "Modo supervivencia",
    description: "Una atmósfera de survival horror: instalaciones oscuras, señalética de emergencia y acentos carmesí y verde.",
    glyph: "🧬", collection: "Universos", brandTitle: "RESIDENT EVIL", brandSubtitle: "SURVIVE THE DAY",
    workspaceColor: { light: "#101712", dark: "#101712" },
    preview: { background: "#101712", sidebar: "#0A100D", primary: "#A83236", accent: "#B8C69A" },
  },
  {
    id: "zelda", name: "The Legend of Zelda", tagline: "Valor, sabiduría y poder",
    description: "Bosques de Hyrule, pergaminos, ruinas antiguas y detalles dorados con aire de aventura.",
    glyph: "🗡️", collection: "Universos", brandTitle: "HYRULE CHRONICLES", brandSubtitle: "A HERO'S JOURNEY",
    workspaceColor: { light: "#EEE5CF", dark: "#101D17" },
    preview: { background: "#13271D", sidebar: "#09140F", primary: "#B99A4D", accent: "#E8CF80" },
  },
  {
    id: "mario", name: "Super Mario Bros.", tagline: "Power-up your day",
    description: "Cielos azules, bloques sorpresa, monedas, estrellas y energía del Reino Champiñón.",
    glyph: "🍄", collection: "Universos", brandTitle: "MUSHROOM KINGDOM", brandSubtitle: "POWER UP YOUR DAY",
    workspaceColor: { light: "#E6F4FF", dark: "#11243D" },
    preview: { background: "#168DE2", sidebar: "#0A1930", primary: "#EF3340", accent: "#FFD44C" },
  },
  {
    id: "chess", name: "Ajedrez", tagline: "Piensa antes de mover",
    description: "Club de ajedrez: paño verde, madera, marfil y una estética sobria para planear cada movimiento.",
    glyph: "♟", collection: "Estilos", brandTitle: "CHESS CLUB", brandSubtitle: "THINK BEFORE YOU MOVE",
    workspaceColor: { light: "#E9E2D0", dark: "#182B25" },
    preview: { background: "#18382D", sidebar: "#102019", primary: "#C6A15B", accent: "#E8E1D0" },
  },
];

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && BUILT_IN_SKINS.some((skin) => skin.id === value);
}
