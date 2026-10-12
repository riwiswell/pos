import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePrivatePhotos } from "@/hooks/use-private-photos";

interface Props {
  /** Private image storage paths belonging to one record. */
  paths: string[];
  label?: string;
}

/** Shared photo strip for any domain, using the common private-media service. */
export function PhotoStrip({ paths, label = "Fotos" }: Props) {
  const photos = usePrivatePhotos(paths);
  const [open, setOpen] = useState<string | null>(null);

  if (paths.length === 0) return null;
  const items = photos.data ?? [];
  if (photos.isSuccess && items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {photos.isError ? (
        <p className="text-xs text-muted-foreground">No se pudieron cargar las fotos.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.path}
              type="button"
              aria-label="Ampliar foto"
              className="overflow-hidden rounded-xl border border-border"
              onClick={() => setOpen(item.url)}
            >
              <img src={item.url} alt={label} className="h-20 w-20 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <Dialog open={Boolean(open)} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="max-w-2xl p-2">
          {open && <img src={open} alt="Foto ampliada" className="max-h-[80vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
