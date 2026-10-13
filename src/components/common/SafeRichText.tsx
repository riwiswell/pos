import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { decodeHtmlEntities, richTextToPlainText } from "@/lib/html-text";

const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI",
  "H1", "H2", "H3", "BLOCKQUOTE", "PRE", "CODE", "HR", "A",
]);
const REMOVE_WITH_CONTENT = "script,style,iframe,object,embed,svg,math,form,input,button,textarea,select,video,audio,link,meta,base";

function safeHref(value: string): string | null {
  const href = value.trim();
  if (!href || href.startsWith("//")) return null;
  if (href.startsWith("#")) return href;
  try {
    const parsed = new URL(href, window.location.origin);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) return href;
  } catch {
    return null;
  }
  return null;
}

function sanitizeRichHtml(input: string): string {
  const document = new DOMParser().parseFromString(decodeHtmlEntities(input), "text/html");
  document.querySelectorAll(REMOVE_WITH_CONTENT).forEach((node) => node.remove());

  const elements = Array.from(document.body.querySelectorAll("*")).reverse();
  for (const element of elements) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (element.tagName !== "A" || attribute.name.toLowerCase() !== "href") {
        element.removeAttribute(attribute.name);
      }
    }

    if (element.tagName === "A") {
      const href = element.getAttribute("href");
      if (href) {
        const safe = safeHref(href);
        if (safe) {
          element.setAttribute("href", safe);
          element.setAttribute("rel", "nofollow noopener noreferrer");
        } else {
          element.removeAttribute("href");
        }
      }
    }
  }

  return document.body.innerHTML;
}

function plainFallback(input: string): string {
  return richTextToPlainText(input);
}

/**
 * Renders rich text imported from the database through a strict tag/attribute
 * allow-list. On the server and during hydration, only escaped plain text is
 * rendered; DOMParser sanitization runs after mount in the browser.
 */
export function SafeRichText({ html, className, emptyLabel = "" }: {
  html: string | null | undefined;
  className?: string;
  emptyLabel?: string;
}) {
  const source = html ?? "";
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  useEffect(() => {
    setSafeHtml(sanitizeRichHtml(source));
  }, [source]);

  if (!source.trim()) return emptyLabel ? <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p> : null;
  if (safeHtml === null) return <div className={cn("whitespace-pre-wrap text-sm", className)}>{plainFallback(source)}</div>;
  if (!safeHtml.trim()) return null;
  return <div className={cn(className)} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
