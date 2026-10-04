import { useQuery } from "@tanstack/react-query";

import { financeService } from "@/services/finance.service";

/**
 * Resolves storage paths from the private `finance-photos` bucket into
 * short-lived signed URLs. One query per transaction; cached for 50 min.
 */
export function useFinancePhotos(paths: string[], enabled = true) {
  return useQuery({
    queryKey: ["finance-photos", ...paths],
    enabled: enabled && paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const urls: { path: string; url: string }[] = [];
      for (const path of paths) {
        const url = await financeService.photoUrl(path);
        if (url) urls.push({ path, url });
      }
      return urls;
    },
  });
}