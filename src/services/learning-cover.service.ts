export type LearningCoverKind = "book" | "movie" | "game";

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function secureImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

async function findWikipediaImage(title: string, subject: "film" | "video game") {
  const query = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `"${title}" ${subject}`,
    gsrnamespace: "0",
    gsrlimit: "8",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${query.toString()}`);
  if (!response.ok) return null;
  const payload = await response.json() as { query?: { pages?: Array<{ title?: string; thumbnail?: { source?: string } }> } };
  const wanted = normalizeTitle(title);
  const pages = payload.query?.pages ?? [];
  const ranked = pages
    .map((page) => {
      const candidate = normalizeTitle(page.title ?? "");
      const exact = candidate === wanted;
      const close = candidate.startsWith(wanted + " ") || wanted.startsWith(candidate + " ");
      return { page, score: exact ? 0 : close ? 1 : 9 };
    })
    .filter((entry) => entry.score < 9 && entry.page.thumbnail?.source)
    .sort((a, b) => a.score - b.score);
  return secureImageUrl(ranked[0]?.page.thumbnail?.source);
}

async function findSteamGameCover(title: string) {
  const query = new URLSearchParams({ term: title, l: "english", cc: "us" });
  const response = await fetch(`https://store.steampowered.com/api/storesearch/?${query.toString()}`);
  if (!response.ok) return null;
  const payload = await response.json() as { items?: Array<{ id?: number; name?: string }> };
  const wanted = normalizeTitle(title);
  const items = payload.items ?? [];
  const match = items.find((item) => normalizeTitle(item.name ?? "") === wanted)
    ?? items.find((item) => normalizeTitle(item.name ?? "").startsWith(wanted));
  if (!match?.id) return null;
  return `https://cdn.akamai.steamstatic.com/steam/apps/${match.id}/library_600x900.jpg`;
}

async function findGoogleBooksCover(title: string, author?: string) {
  const terms = [`intitle:${title}`, author?.trim() ? `inauthor:${author.trim()}` : ""].filter(Boolean);
  const query = new URLSearchParams({ q: terms.join(" "), maxResults: "8", projection: "lite" });
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${query.toString()}`);
  if (!response.ok) return null;
  const payload = await response.json() as { items?: Array<{ volumeInfo?: { title?: string; imageLinks?: Record<string, string> } }> };
  const wanted = normalizeTitle(title);
  const items = payload.items ?? [];
  const best = items.find((item) => normalizeTitle(item.volumeInfo?.title ?? "") === wanted)
    ?? items.find((item) => normalizeTitle(item.volumeInfo?.title ?? "").startsWith(wanted));
  const links = best?.volumeInfo?.imageLinks;
  return secureImageUrl(links?.extraLarge ?? links?.large ?? links?.medium ?? links?.small ?? links?.thumbnail ?? links?.smallThumbnail);
}

/**
 * Returns a suggested public cover URL. The match is optional: a missing
 * result never prevents saving the learning item, and the user can upload a
 * different cover manually.
 */
export async function lookupLearningCover(input: {
  kind: LearningCoverKind;
  title: string;
  author?: string;
}): Promise<string | null> {
  const title = input.title.trim();
  if (!title) return null;
  try {
    if (input.kind === "book") return await findGoogleBooksCover(title, input.author);
    if (input.kind === "game") {
      const steam = await findSteamGameCover(title).catch(() => null);
      return steam ?? await findWikipediaImage(title, "video game");
    }
    return await findWikipediaImage(title, "film");
  } catch {
    return null;
  }
}
