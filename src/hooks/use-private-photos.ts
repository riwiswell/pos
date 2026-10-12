import { useQuery } from "@tanstack/react-query";
import { privateMediaService } from "@/services/private-media.service";

/** Resolve private image paths into short-lived URLs, independent of domain. */
export function usePrivatePhotos(paths: string[], enabled = true) {
  return useQuery({
    queryKey: ["private-media", ...paths],
    enabled: enabled && paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const urls: { path: string; url: string }[] = [];
      for (const path of paths) {
        const url = await privateMediaService.photoUrl(path);
        if (url) urls.push({ path, url });
      }
      return urls;
    },
  });
}
