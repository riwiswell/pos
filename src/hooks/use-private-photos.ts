import { useQuery } from "@tanstack/react-query";
import { privateMediaService } from "@/services/private-media.service";

type CachedPhoto = {
  url: string;
  resolvedAt: number;
  expiresAt: number;
  decodedImage?: HTMLImageElement;
};

const SIGNED_URL_CACHE_MS = 55 * 60 * 1000;
const PRIVATE_PHOTO_CACHE_LIMIT = 180;

// Keep signed URLs and decoded image resources alive across route unmounts.
const privatePhotoCache = new Map<string, CachedPhoto>();

function getCachedPhoto(path: string): CachedPhoto | undefined {
  const entry = privatePhotoCache.get(path);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    privatePhotoCache.delete(path);
    return undefined;
  }
  privatePhotoCache.delete(path);
  privatePhotoCache.set(path, entry);
  return entry;
}

function rememberPhoto(path: string, url: string): CachedPhoto {
  const now = Date.now();
  const entry: CachedPhoto = { url, resolvedAt: now, expiresAt: now + SIGNED_URL_CACHE_MS };
  if (typeof window !== "undefined") {
    const decodedImage = new window.Image();
    decodedImage.decoding = "async";
    decodedImage.src = url;
    entry.decodedImage = decodedImage;
    void decodedImage.decode().catch(() => undefined);
  }
  privatePhotoCache.delete(path);
  privatePhotoCache.set(path, entry);
  while (privatePhotoCache.size > PRIVATE_PHOTO_CACHE_LIMIT) {
    const oldest = privatePhotoCache.keys().next().value;
    if (oldest === undefined) break;
    privatePhotoCache.delete(oldest);
  }
  return entry;
}

function cachedPhotoResults(paths: string[]) {
  const results = paths.map((path) => {
    const entry = getCachedPhoto(path);
    return entry ? { path, url: entry.url, resolvedAt: entry.resolvedAt } : null;
  });
  if (results.some((entry) => entry === null)) return undefined;
  return results as { path: string; url: string; resolvedAt: number }[];
}

/** Resolve and pre-decode private images once, then reuse them across navigation. */
export function usePrivatePhotos(paths: string[], enabled = true) {
  return useQuery({
    queryKey: ["private-media", ...paths],
    enabled: enabled && paths.length > 0,
    initialData: () => {
      const cached = cachedPhotoResults(paths);
      return cached?.map(({ path, url }) => ({ path, url }));
    },
    initialDataUpdatedAt: () => {
      const cached = cachedPhotoResults(paths);
      return cached?.length ? Math.min(...cached.map((entry) => entry.resolvedAt)) : 0;
    },
    staleTime: SIGNED_URL_CACHE_MS,
    gcTime: 2 * 60 * 60 * 1000,
    queryFn: async () => {
      const urls: { path: string; url: string }[] = [];
      for (const path of paths) {
        const cached = getCachedPhoto(path);
        if (cached) {
          urls.push({ path, url: cached.url });
          continue;
        }
        const url = await privateMediaService.photoUrl(path);
        if (url) {
          rememberPhoto(path, url);
          urls.push({ path, url });
        }
      }
      return urls;
    },
  });
}
