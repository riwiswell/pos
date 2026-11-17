export const EMOTIONS = [
  { label: "Alegría", emoji: "😊", tone: "border-amber-400/50 bg-amber-400/10" },
  { label: "Calma", emoji: "😌", tone: "border-sky-400/50 bg-sky-400/10" },
  { label: "Amor", emoji: "❤️", tone: "border-rose-400/50 bg-rose-400/10" },
  { label: "Gratitud", emoji: "🙏", tone: "border-emerald-400/50 bg-emerald-400/10" },
  { label: "Ilusión", emoji: "🤩", tone: "border-violet-400/50 bg-violet-400/10" },
  { label: "Tranquilidad", emoji: "🌿", tone: "border-teal-400/50 bg-teal-400/10" },
  { label: "Neutralidad", emoji: "😐", tone: "border-slate-400/50 bg-slate-400/10" },
  { label: "Tristeza", emoji: "😔", tone: "border-blue-400/50 bg-blue-400/10" },
  { label: "Ansiedad", emoji: "😟", tone: "border-orange-400/50 bg-orange-400/10" },
  { label: "Miedo", emoji: "😨", tone: "border-indigo-400/50 bg-indigo-400/10" },
  { label: "Enojo", emoji: "😠", tone: "border-red-400/50 bg-red-400/10" },
  { label: "Frustración", emoji: "😣", tone: "border-orange-500/50 bg-orange-500/10" },
  { label: "Cansancio", emoji: "😴", tone: "border-zinc-400/50 bg-zinc-400/10" },
  { label: "Soledad", emoji: "🫥", tone: "border-purple-400/50 bg-purple-400/10" },
] as const;

export type EmotionLabel = (typeof EMOTIONS)[number]["label"];
