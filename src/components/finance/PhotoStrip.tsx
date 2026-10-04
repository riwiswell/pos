import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFinancePhotos } from "@/hooks/use-finance-photos";

interface Props {
  /** Storage paths of the selected transaction only. */
  paths: string[];
}

/**
 * Real photo strip: signed thumbnails from the private finance-photos bucket.
 * Tap a photo to enlarge it. Renders nothing when the movement has no photos.
 */
export function PhotoStrip({ paths }: Props) {
  const photos = useFinancePhotos(paths);
  const [open, setOpen] = useState<string | null>(null);

  if (paths.length === 0) return null;

  const items = photos.data ?? [];
  if (photos.isSuccess && items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Fotos</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.path}
            type="button"
            aria-label="Ampliar foto"
            className="overflow-hidden rounded-xl border border-border"
            onClick={() => setOpen(item.url)}
          >
            <img
              src={item.url}
              alt="Foto del movimiento"
              className="h-20 w-20 object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="max-w-2xl p-2">
          {open && (
            <img
              src={open}
              alt="Foto ampliada del movimiento"
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}