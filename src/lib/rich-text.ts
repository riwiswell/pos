/**
 * Convert saved editor HTML into readable text for compact summaries and
 * plain-text detail fields. Never render stored HTML as markup here.
 */
export function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  if (!/<[a-z][\s\S]*>/i.test(value) && !/&(?:nbsp|amp|lt|gt|quot|#\d+|#x[\da-f]+);/i.test(value)) {
    return value;
  }
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(value, "text/html");
    doc.querySelectorAll("script,style").forEach((node) => node.remove());
    return (doc.body.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }
  return value
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
