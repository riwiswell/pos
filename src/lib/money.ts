/** Money helpers for PERSONAL OS (COP by default, no decimals shown). */

const formatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return formatter.format(Math.round(value));
}

export function formatMoneySigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(value))}`;
}

/** Digits-only parsing so the amount field stays a 3-second interaction. */
export function parseAmountInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits);
}

/** Groups digits while typing: 6000 -> "6.000". */
export function formatAmountInput(raw: string): string {
  const value = parseAmountInput(raw);
  if (!value) return "";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}

export function hiddenMoney(): string {
  return "••••••";
}