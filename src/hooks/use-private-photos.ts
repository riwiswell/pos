import { useQuery } from "@tanstack/react-query";
import { privateMediaService } from "@/services/private-media.service";

type CachedPhoto = {
  url: string;
  resolvedAt: number;
  expiresAt: number;
  decodedImage?: HTMLImageElement;
  decoded: boolean;
  ready: Promise<void>;
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
  const entry: CachedPhoto = {
    url,
    resolvedAt: now,
    expiresAt: now + SIGNED_URL_CACHE_MS,
    decoded: typeof window === "undefined",
    ready: Promise.resolve(),
  };
  if (typeof window !== "undefined") {
    const decodedImage = new window.Image();
    decodedImage.decoding = "async";
    decodedImage.fetchPriority = "high";
    entry.decodedImage = decodedImage;
    // Resolve the cache entry only after the browser has fetched and decoded
    // the bytes. A failed image is removed so a later query can retry it.
    const imageReady = new Promise<void>((resolve, reject) => {
      decodedImage.onload = () => {
        if (typeof decodedImage.decode === "function") {
          void decodedImage.decode().then(resolve, reject);
        } else {
          resolve();
        }
      };
      decodedImage.onerror = () => reject(new Error("No se pudo cargar la portada privada."));
      decodedImage.src = url;
    });
    entry.ready = imageReady
      .then(() => { entry.decoded = true; })
      .catch((error: unknown) => {
        if (privatePhotoCache.get(path) === entry) privatePhotoCache.delete(path);
        throw error;
      });
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
    return entry?.decoded ? { path, url: entry.url, resolvedAt: entry.resolvedAt } : null;
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
          await cached.ready;
          if (cached.decoded) urls.push({ path, url: cached.url });
          continue;
        }
        const url = await privateMediaService.photoUrl(path);
        if (url) {
          const photo = rememberPhoto(path, url);
          await photo.ready;
          if (photo.decoded) urls.push({ path, url: photo.url });
        }
      }
      return urls;
    },
  });
}
