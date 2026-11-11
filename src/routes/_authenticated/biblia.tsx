import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { BibleReadingPanel } from "@/components/learning/BibleReadingPanel";
import { useLGList, useLGMutations } from "@/hooks/use-life-graph";
import { usePrivatePhotos } from "@/hooks/use-private-photos";
import { privateMediaService } from "@/services/private-media.service";

export const Route = createFileRoute("/_authenticated/biblia")({
  component: BiblePage,
});

function BiblePage() {
  const books = useLGList("learning_items");
  const bible = (books.data ?? []).find((item: any) =>
    item.kind === "book" && ["la biblia", "biblia"].includes(String(item.title ?? "").trim().toLowerCase())
  );

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <GlobalDateHeader />
      <div className="space-y-2">
        <a href="/aprendizaje" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <span aria-hidden="true">←</span> Volver a Aprendizaje
        </a>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Plan Bíblico</h1>
            <p className="text-sm text-muted-foreground">Tu lectura, progreso y registro diario en una pantalla independiente.</p>
          </div>
        </div>
      </div>
      {books.isLoading
        ? <div className="rounded-xl border p-4 text-sm text-muted-foreground">Cargando tu plan bíblico…</div>
        : books.isError
          ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">No se pudo cargar tu biblioteca.</div>
          : bible
            ? <>
                <BibleCoverEditor bible={bible} />
                <BibleReadingPanel learningItemId={bible.id} />
              </>
            : <div className="rounded-xl border p-4 text-sm text-muted-foreground">No encontramos «La Biblia» en tu biblioteca. Agrégala desde Aprendizaje para activar el plan.</div>}
    </main>
  );
}

function BibleCoverEditor({ bible }: { bible: any }) {
  const mutations = useLGMutations("learning_items");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const coverPath = typeof bible.cover_path === "string" ? bible.cover_path : null;
  const coverQuery = usePrivatePhotos(coverPath ? [coverPath] : [], Boolean(coverPath));
  const coverUrl = coverQuery.data?.find((photo) => photo.path === coverPath)?.url;

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const nextPath = await privateMediaService.uploadPhoto(file);
      try {
        await mutations.update.mutateAsync({ id: bible.id, patch: { cover_path: nextPath } });
      } catch (error) {
        await privateMediaService.removePhoto(nextPath).catch(() => undefined);
        throw error;
      }
      if (coverPath && coverPath !== nextPath) {
        await privateMediaService.removePhoto(coverPath).catch(() => undefined);
      }
      toast.success("Portada de la Biblia actualizada.");
    } catch (error) {
      const detail = error && typeof error === "object" && "message" in error
        ? String((error as any).message)
        : "No se pudo guardar la portada. Revisa el permiso de almacenamiento e inténtalo de nuevo.";
      toast.error(detail);
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="w-24 shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-950 shadow-sm">
          {coverUrl
            ? <img src={coverUrl} alt="Portada de la Biblia" className="h-full w-full object-cover" />
            : <div className="flex h-full flex-col items-center justify-between p-3 text-center text-white">
                <BookOpen className="mt-2 h-7 w-7 opacity-80" />
                <span className="text-xs font-semibold">La Biblia</span>
                <span className="text-[8px] uppercase tracking-[.18em] opacity-70">Mi biblioteca</span>
              </div>}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="font-semibold">Portada de la Biblia</h2>
        <p className="text-sm text-muted-foreground">Personaliza tu plan con una foto de la portada de tu propia Biblia.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <ImagePlus className="mr-2 h-4 w-4" />
          {uploading ? "Subiendo foto…" : coverPath ? "Cambiar portada" : "Agregar portada"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
          className="sr-only"
          onChange={uploadCover}
        />
      </div>
    </section>
  );
}
