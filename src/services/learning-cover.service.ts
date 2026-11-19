export type LearningCoverKind = "book" | "movie" | "game";

type CoverLookupResponse = {
  coverUrl?: string | null;
  error?: string;
};

const CACHEABLE_COVER_HOSTS = new Set([
  "books.google.com",
  "books.googleusercontent.com",
  "upload.wikimedia.org",
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "shared.fastly.steamstatic.com",
  "steamcdn-a.akamaihd.net",
]);
const CACHED_COVER_PREFIX = "/api/learning-cover-image?";
const preloadedCoverImages = new Map<string, Promise<void>>();

/** Warm and decode a cover once so opening a book or game card is immediate. */
export function preloadLearningCover(url: string | null | undefined): void {
  if (!url || typeof window === "undefined" || preloadedCoverImages.has(url)) return;
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  const loaded = new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });
  preloadedCoverImages.set(url, loaded);
  image.src = url;
  if (image.complete && typeof image.decode === "function") {
    void image.decode().catch(() => undefined);
  }
  if (preloadedCoverImages.size > 180) {
    const oldest = preloadedCoverImages.keys().next().value;
    if (oldest) preloadedCoverImages.delete(oldest);
  }
}


/** Distinguish provider URLs and our same-origin cached image path from private Storage paths. */
export function isRemoteLearningCoverPath(path: string | null | undefined): boolean {
  return typeof path === "string" &&
    (/^https?:\/\//i.test(path) || path.startsWith(CACHED_COVER_PREFIX));
}

/** Route known provider covers through the same-origin cache; leave private uploads untouched. */
export function resolveLearningCoverUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const input = value.trim();
  if (input.startsWith(CACHED_COVER_PREFIX)) return input;

  try {
    const parsed = new URL(input);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    if (parsed.protocol !== "https:") return null;
    if (!CACHEABLE_COVER_HOSTS.has(parsed.hostname.toLowerCase())) return parsed.toString();
    const params = new URLSearchParams({ source: parsed.toString() });
    return CACHED_COVER_PREFIX + params.toString();
  } catch {
    return null;
  }
}

/**
 * Ask the same-origin Cloudflare Worker to look up a cover.
 * External providers are called server-side so browser CORS restrictions
 * cannot silently break Steam, Wikipedia, or Google Books lookups.
 *
 * This only resolves the title explicitly supplied by the user. It does not
 * connect to a Steam account or import any owned/shared game library.
 */
export async function lookupLearningCover(input: {
  kind: LearningCoverKind;
  title: string;
  author?: string;
}): Promise<string | null> {
  const title = input.title.trim();
  if (!title) return null;

  const params = new URLSearchParams({
    kind: input.kind,
    title,
  });
  if (input.author?.trim()) params.set("author", input.author.trim());

  try {
    const response = await fetch(`/api/learning-cover?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = await response.json() as CoverLookupResponse;
    const coverUrl = payload.coverUrl;
    if (typeof coverUrl !== "string" || !coverUrl.trim()) return null;

    const parsed = new URL(coverUrl);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
