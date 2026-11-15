export type LearningCoverKind = "book" | "movie" | "game";

type CoverLookupResponse = {
  coverUrl?: string | null;
  error?: string;
};

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
