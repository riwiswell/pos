/** Broad, dark-theme friendly palette for accounts and categories. */
export const COLOR_PALETTE: string[] = [
  "#f87171", "#fb7185", "#f472b6", "#e879f9", "#c084fc", "#a78bfa",
  "#818cf8", "#60a5fa", "#38bdf8", "#22d3ee", "#2dd4bf", "#34d399",
  "#4ade80", "#a3e635", "#facc15", "#fbbf24", "#fb923c", "#f97316",
  "#ef4444", "#dc2626", "#d946ef", "#8b5cf6", "#3b82f6", "#0ea5e9",
  "#06b6d4", "#14b8a6", "#10b981", "#84cc16", "#eab308", "#f59e0b",
  "#94a3b8", "#64748b", "#a8a29e", "#78716c", "#cbd5e1", "#e2e8f0",
];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}