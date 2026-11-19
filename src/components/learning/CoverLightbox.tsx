import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function CoverLightbox({
  src,
  alt,
  title,
  triggerClassName = "h-full w-full cursor-zoom-in",
  imageClassName = "h-full w-full object-cover",
}: {
  src: string;
  alt: string;
  title: string;
  triggerClassName?: string;
  imageClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={"Ver portada ampliada: " + title}
        title="Ver imagen ampliada"
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={alt} loading="eager" decoding="async" className={imageClassName} />
      </button>
      <DialogContent className="flex max-h-[94vh] w-[min(96vw,1000px)] max-w-[96vw] flex-col items-center justify-center gap-2 border-0 bg-black/95 p-3 text-white shadow-2xl sm:rounded-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Imagen ampliada. Pulsa Escape o el botón cerrar para volver a la ficha.</DialogDescription>
        <img
          src={src}
          alt={alt}
          className="max-h-[84vh] max-w-full rounded-lg object-contain"
          decoding="async"
        />
        <p className="max-w-full truncate px-8 text-center text-xs text-white/80">{title}</p>
      </DialogContent>
    </Dialog>
  );
}
