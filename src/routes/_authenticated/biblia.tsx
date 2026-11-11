import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { BibleReadingPanel } from "@/components/learning/BibleReadingPanel";
import { useLGList } from "@/hooks/use-life-graph";

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
            ? <BibleReadingPanel learningItemId={bible.id} />
            : <div className="rounded-xl border p-4 text-sm text-muted-foreground">No encontramos «La Biblia» en tu biblioteca. Agrégala desde Aprendizaje para activar el plan.</div>}
    </main>
  );
}
