export function describeError(error: unknown, fallback: string): string {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = error instanceof Error
    ? error.message
    : typeof value.message === "string" && value.message.trim()
      ? value.message
      : fallback;
  const code = typeof value.code === "string" ? value.code : "";
  const details = typeof value.details === "string" ? value.details.trim() : "";
  const hint = typeof value.hint === "string" ? value.hint.trim() : "";
  return [message, code ? `[${code}]` : "", details, hint].filter(Boolean).join(" · ");
}
