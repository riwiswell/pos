/**
 * Runtime-independent helpers for legacy rich-text values.
 * Decode old HTML-escaped editor content and remove markup for compact previews.
 * Rich display paths must still sanitize decoded markup before rendering.
 */
export function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“",
    rdquo: "”", hellip: "…", copy: "©", reg: "®",
  };
  let value = input;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (!Number.isFinite(point) || point < 0 || point > 0x10ffff) return match;
        try { return String.fromCodePoint(point); } catch { return match; }
      }
      return named[entity.toLowerCase()] ?? match;
    });
    if (next === value) break;
    value = next;
  }
  return value;
}

export function richTextToPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return decodeHtmlEntities(input)
    .replace(/<\s*(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/(p|div|li|h[1-6]|blockquote|pre|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
